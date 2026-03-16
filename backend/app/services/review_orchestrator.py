import asyncio
import base64
import logging
from datetime import UTC, datetime
from uuid import uuid4

from google import genai
from google.genai import types

from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import SessionStatus
from app.schemas.verdict import AnalyzeSessionResponse
from app.services.agents_client import AgentsClient
from app.services.speech_stream import SpeechStreamManager
from app.ws.manager import ConnectionManager

logger = logging.getLogger("uvicorn.error")


class ReviewOrchestrator:
    def __init__(
        self,
        repo: SessionRepository,
        agents_client: AgentsClient,
        ws_manager: ConnectionManager,
        speech_stream_manager: SpeechStreamManager,
    ) -> None:
        self._repo = repo
        self._agents_client = agents_client
        self._ws_manager = ws_manager
        self._speech_stream_manager = speech_stream_manager

    async def _publish_turn_state(
        self,
        session_id: str,
        turn_id: str,
        state: str,
        reason: str | None = None,
    ) -> None:
        self._repo.set_turn_state(session_id=session_id, turn_id=turn_id, state=state)
        payload: dict[str, str] = {"session_id": session_id, "turn_id": turn_id, "state": state}
        if reason:
            payload["reason"] = reason
        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "turn.status",
                "payload": payload,
            },
        )

    async def _emit_speech(
        self,
        session_id: str,
        turn_id: str,
        verdict_id: str,
        spoken_text: str,
    ) -> None:
        logger.warning(
            "Speech pipeline entered (session_id=%s turn_id=%s chars=%d)",
            session_id,
            turn_id,
            len(spoken_text or ""),
        )
        utterance_id = f"utt_{uuid4().hex[:12]}"
        words = spoken_text.split()
        if not words:
            logger.warning("Speech pipeline skipped because spoken_text was empty")
            return

        async def emit_live_audio() -> None:
            client = genai.Client(http_options={"api_version": "v1alpha"})
            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                    )
                ),
            )
            model_candidates = [
                "gemini-2.5-flash-native-audio-preview-12-2025",
                "gemini-2.5-flash-native-audio-preview-09-2025",
            ]
            for model_name in model_candidates:
                logger.info("Starting Gemini Live audio session (model=%s)", model_name)
                try:
                    async with client.aio.live.connect(
                        model=model_name,
                        config=config,
                    ) as live_session:
                        await live_session.send_realtime_input(text=spoken_text)
                        chunk_index = 0
                        async for response in live_session.receive():
                            server_content = getattr(response, "server_content", None)
                            model_turn = getattr(server_content, "model_turn", None) if server_content else None
                            if model_turn and getattr(model_turn, "parts", None):
                                for part in model_turn.parts:
                                    inline_data = getattr(part, "inline_data", None)
                                    if not inline_data:
                                        continue
                                    data = getattr(inline_data, "data", None)
                                    if not data:
                                        continue
                                    if isinstance(data, str):
                                        audio_b64 = data
                                    else:
                                        audio_b64 = base64.b64encode(data).decode("utf-8")
                                    if chunk_index == 0:
                                        logger.info("Gemini Live first audio chunk received (model=%s)", model_name)
                                    await self._ws_manager.broadcast(
                                        session_id,
                                        {
                                            "type": "speech.audio.chunk",
                                            "payload": {
                                                "session_id": session_id,
                                                "turn_id": turn_id,
                                                "verdict_id": verdict_id,
                                                "utterance_id": utterance_id,
                                                "chunk_index": chunk_index,
                                                "audio_base64": audio_b64,
                                                "mime_type": "audio/pcm;rate=24000",
                                                "sample_rate_hz": 24000,
                                            },
                                        },
                                    )
                                    chunk_index += 1

                            if server_content and getattr(server_content, "turn_complete", False):
                                break

                        if chunk_index > 0:
                            logger.info("Gemini Live emitted %d audio chunk(s) (model=%s)", chunk_index, model_name)
                            return
                        logger.warning("Gemini Live produced zero audio chunks (model=%s)", model_name)
                except Exception as exc:
                    logger.warning("Gemini Live model failed (model=%s): %s", model_name, exc)
                    continue

            raise RuntimeError("No Gemini Live model produced audio chunks")

        async def stream_task() -> None:
            chunk_size = 12
            chunks = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]
            for index, chunk in enumerate(chunks):
                event_type = "speech.chunk"
                if index == 0:
                    event_type = "speech.start"
                if index == len(chunks) - 1:
                    event_type = "speech.end"
                await self._ws_manager.broadcast(
                    session_id,
                    {
                        "type": event_type,
                        "payload": {
                            "session_id": session_id,
                            "turn_id": turn_id,
                            "verdict_id": verdict_id,
                            "utterance_id": utterance_id,
                            "chunk_index": index,
                            "text": chunk,
                            "is_final_chunk": index == len(chunks) - 1,
                        },
                    },
                )
                self._repo.append_turn_transcript(session_id=session_id, turn_id=turn_id, text=chunk)

            try:
                await emit_live_audio()
            except Exception as exc:
                logger.warning("Gemini Live audio unavailable, keeping text-only stream: %s", exc)
                return

        task = asyncio.create_task(stream_task())
        await self._speech_stream_manager.register(session_id=session_id, turn_id=turn_id, task=task)
        try:
            await task
        except asyncio.CancelledError:
            pass
        finally:
            await self._speech_stream_manager.clear(session_id=session_id, turn_id=turn_id, task=task)

    async def handle_user_interrupt(
        self,
        session_id: str,
        turn_id: str,
        utterance_id: str,
        interruption_id: str,
        intent: str,
        transcript: str,
    ) -> None:
        current_state = self._repo.get_turn_state(session_id=session_id, turn_id=turn_id)
        if current_state == "interrupted":
            return

        await self._speech_stream_manager.cancel(session_id=session_id, turn_id=turn_id)
        self._repo.mark_turn_interrupted(session_id=session_id, turn_id=turn_id, intent=intent)
        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "user.interrupted",
                "payload": {
                    "session_id": session_id,
                    "turn_id": turn_id,
                    "utterance_id": utterance_id,
                    "interruption_id": interruption_id,
                    "intent": intent,
                    "transcript": transcript,
                    "interrupted_at": datetime.now(UTC).isoformat(),
                },
            },
        )
        await self._publish_turn_state(
            session_id=session_id,
            turn_id=turn_id,
            state="interrupted",
            reason="user_interrupt",
        )
        next_turn_id = self._repo.next_turn_id(session_id=session_id)
        await self._publish_turn_state(
            session_id=session_id,
            turn_id=next_turn_id,
            state="collecting",
            reason="follow_up_after_interrupt",
        )
        await self._publish_turn_state(
            session_id=session_id,
            turn_id=next_turn_id,
            state="deliberating",
            reason="follow_up_after_interrupt",
        )

    async def analyze(self, session_id: str) -> AnalyzeSessionResponse:
        session = self._repo.get(session_id)
        if session is None:
            raise ValueError("Session not found")

        turn_id = self._repo.next_turn_id(session_id)

        self._repo.set_status(session_id, SessionStatus.processing)
        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "session.status",
                "payload": {"session_id": session_id, "status": SessionStatus.processing},
            },
        )
        await self._publish_turn_state(session_id=session_id, turn_id=turn_id, state="collecting")

        for progress in (15, 45, 75):
            await self._ws_manager.broadcast(
                session_id,
                {
                    "type": "analysis.progress",
                    "payload": {"session_id": session_id, "progress": progress},
                },
            )
        await self._publish_turn_state(session_id=session_id, turn_id=turn_id, state="deliberating")

        try:
            result = await self._agents_client.analyze(session_id=session_id, angles=session.angles)
        except Exception:
            self._repo.set_status(session_id, SessionStatus.error)
            await self._ws_manager.broadcast(
                session_id,
                {
                    "type": "session.status",
                    "payload": {"session_id": session_id, "status": SessionStatus.error},
                },
            )
            await self._publish_turn_state(
                session_id=session_id,
                turn_id=turn_id,
                state="done",
                reason="analysis_error",
            )
            raise

        self._repo.set_verdict(session_id, result.verdict)
        self._repo.set_status(session_id, SessionStatus.complete)

        verdict_id = f"v_{uuid4().hex[:12]}"
        committed_at = datetime.now(UTC).isoformat()
        rationale_points = [result.verdict.summary]
        evidence_refs = [
            {"angle_id": item.angle_id, "timestamp_sec": item.timestamp_sec}
            for item in result.verdict.evidence
        ]
        spoken_text = (
            f"Verdict: {result.verdict.level.value}. "
            f"{result.verdict.summary} "
            f"Rule reference: {result.verdict.rule_reference}. "
            f"Confidence: {result.verdict.confidence * 100:.0f} percent."
        )

        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "verdict.committed",
                "payload": {
                    "session_id": session_id,
                    "turn_id": turn_id,
                    "verdict_id": verdict_id,
                    "claim": {
                        "level": result.verdict.level,
                        "summary": result.verdict.summary,
                        "rule_reference": result.verdict.rule_reference,
                        "confidence": result.verdict.confidence,
                    },
                    "rationale_points": rationale_points,
                    "evidence_refs": evidence_refs,
                    "committed_at": committed_at,
                },
            },
        )
        self._repo.set_turn_verdict(session_id=session_id, turn_id=turn_id, verdict_id=verdict_id)
        await self._publish_turn_state(session_id=session_id, turn_id=turn_id, state="committed")
        await self._publish_turn_state(session_id=session_id, turn_id=turn_id, state="speaking")
        await self._emit_speech(
            session_id=session_id,
            turn_id=turn_id,
            verdict_id=verdict_id,
            spoken_text=spoken_text,
        )
        turn_state = self._repo.get_turn_state(session_id=session_id, turn_id=turn_id)

        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "analysis.done",
                "payload": result.model_dump(mode="json"),
            },
        )
        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "session.status",
                "payload": {"session_id": session_id, "status": SessionStatus.complete},
            },
        )
        if turn_state == "interrupted":
            return result
        await self._publish_turn_state(session_id=session_id, turn_id=turn_id, state="done")

        return result
