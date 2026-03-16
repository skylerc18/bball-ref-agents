from __future__ import annotations

import asyncio
import json
import re
import sys
from typing import Any
from pathlib import Path

from app.schemas.session import AngleMetadata
from app.schemas.verdict import AnalyzeSessionResponse, EvidenceItem, Verdict, VerdictLevel

AGENTS_ROOT = Path(__file__).resolve().parents[3] / "agents"
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from google.adk.runners import InMemoryRunner
from google.genai import types
from agents.crew_chief import build_crew_chief_agent
from models.settings import AgentModelConfig
from schemas.reports import FinalDecision
from schemas.session import ClipInput, SessionInput, SessionMetadata
from workflows.session_workflow import build_agent_tree, build_session_prompt


def _extract_json_object(text: str) -> str:
    raw = text.strip()
    if raw.startswith("{") and raw.endswith("}"):
        return raw

    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("No JSON object found in agent response")


def _is_final_decision_shape(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    required = {"level", "confidence", "rule_reference", "summary", "rationale"}
    return required.issubset(payload.keys())


def _normalize_text_key(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 ]+", " ", text)).strip().lower()


def _extract_name_like_phrases(text: str) -> set[str]:
    pattern = r"\b[A-Z][A-Za-z'\.-]+\s+[A-Z][A-Za-z'\.-]+\b"
    return {match.group(0) for match in re.finditer(pattern, text)}


def _metadata_guardrail_violations(decision: FinalDecision, metadata: SessionMetadata) -> list[str]:
    combined_text = " ".join([decision.summary, *decision.rationale])
    lowered = combined_text.lower()
    violations: list[str] = []

    banned_phrases = (
        "player in white jersey",
        "player in black jersey",
        "offensive player",
        "defensive player",
        "defensive team",
        "attacking team",
    )
    for phrase in banned_phrases:
        if phrase in lowered:
            violations.append(f"banned_generic_reference:{phrase}")

    allowed_names = {
        _normalize_text_key(player.display_name)
        for player in [*metadata.players_on_court, *metadata.involved_players]
        if getattr(player, "display_name", None)
    }
    if allowed_names:
        ignore_name_candidates = {
            "out of",
            "rule reference",
            "instant replay",
            "coach challenge",
        }
        candidate_names = {_normalize_text_key(name) for name in _extract_name_like_phrases(combined_text)}
        for candidate in candidate_names:
            if not candidate or candidate in ignore_name_candidates:
                continue
            if candidate not in allowed_names:
                violations.append(f"unknown_name:{candidate}")

    involved_names = [
        _normalize_text_key(player.display_name)
        for player in metadata.involved_players
        if player.display_name
    ]
    if involved_names:
        for involved_name in involved_names:
            if involved_name and involved_name not in _normalize_text_key(combined_text):
                violations.append(f"missing_involved_player:{involved_name}")

    return violations


def _normalize_level(level: str) -> VerdictLevel:
    normalized = level.strip().lower()
    if normalized in {VerdictLevel.upheld.value, VerdictLevel.overruled.value, VerdictLevel.inconclusive.value}:
        return VerdictLevel(normalized)
    return VerdictLevel.inconclusive


def _parse_timestamp_seconds(text: str) -> float | None:
    sec_match = re.search(r"(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?\b", text, flags=re.IGNORECASE)
    if sec_match:
        return float(sec_match.group(1))
    mmss_match = re.search(r"\b(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\b", text)
    if mmss_match:
        minutes = int(mmss_match.group(1))
        seconds = int(mmss_match.group(2))
        fraction = float(f"0.{mmss_match.group(3)}") if mmss_match.group(3) else 0.0
        return minutes * 60 + seconds + fraction
    return None


def _extract_evidence_items(decision: FinalDecision, angles: list[AngleMetadata]) -> list[EvidenceItem]:
    angle_by_id = {angle.id.lower(): angle for angle in angles}
    angle_by_label = {angle.label.lower(): angle for angle in angles}
    evidence: list[EvidenceItem] = []

    for idx, rationale in enumerate(decision.rationale, start=1):
        text = rationale.strip()
        if not text:
            continue

        angle_id = angles[0].id if angles else "angle-1"
        lowered = text.lower()
        for known_id, angle in angle_by_id.items():
            if known_id in lowered:
                angle_id = angle.id
                break
        else:
            for known_label, angle in angle_by_label.items():
                if known_label in lowered:
                    angle_id = angle.id
                    break

        timestamp_sec = _parse_timestamp_seconds(text) or 0.0
        evidence.append(
            EvidenceItem(
                id=f"e_{idx}",
                angle_id=angle_id,
                timestamp_sec=timestamp_sec,
                confidence=decision.confidence,
                reason=text,
            )
        )

    if evidence:
        return evidence

    if decision.summary.strip():
        return [
            EvidenceItem(
                id="e_1",
                angle_id=angles[0].id if angles else "angle-1",
                timestamp_sec=_parse_timestamp_seconds(decision.summary) or 0.0,
                confidence=decision.confidence,
                reason=decision.summary.strip(),
            )
        ]

    return []


def _is_retryable_model_error(exc: Exception) -> bool:
    text = str(exc).lower()
    markers = (
        "resource_exhausted",
        "quota exceeded",
        "429",
        "rate limit",
        "too many requests",
        "model not found",
        "unsupported model",
        "permission denied",
        "tool '",
        "available tools: transfer_to_agent",
        "not found",
    )
    return any(marker in text for marker in markers)


def _retry_after_seconds(exc: Exception) -> float:
    text = str(exc).lower()
    # Example provider text: "Please retry in 23.754321379s."
    match = re.search(r"retry in\s+([0-9]+(?:\.[0-9]+)?)s", text)
    if not match:
        return 1.5
    return max(0.5, min(float(match.group(1)), 30.0))


def _model_attempts() -> list[AgentModelConfig]:
    # Rotate model load across roles, then fall back to all-flash.
    return [
        AgentModelConfig(
            orchestrator_model="gemini-2.5-flash",
            specialist_model="gemini-2.5-flash",
            crew_chief_model="gemini-2.5-pro",
        ),
        AgentModelConfig(
            orchestrator_model="gemini-2.5-flash",
            specialist_model="gemini-2.5-pro",
            crew_chief_model="gemini-2.5-flash",
        ),
        AgentModelConfig(
            orchestrator_model="gemini-2.5-pro",
            specialist_model="gemini-2.5-flash",
            crew_chief_model="gemini-2.5-flash",
        ),
        AgentModelConfig(
            orchestrator_model="gemini-2.5-flash",
            specialist_model="gemini-2.5-flash",
            crew_chief_model="gemini-2.5-flash",
        ),
    ]


def _metadata_from_override(metadata_override: dict[str, Any] | None) -> SessionMetadata:
    if metadata_override is None:
        return SessionMetadata()
    try:
        return SessionMetadata.model_validate(metadata_override)
    except Exception:
        return SessionMetadata()


class AgentsClient:
    async def _run_recovery_crew_chief(
        self,
        prompt: str,
        prior_text: str | None,
        model_config: AgentModelConfig,
        constraint_note: str | None = None,
    ) -> tuple[str | None, dict | None]:
        recovery_agent = build_crew_chief_agent(model_config=model_config)
        runner = InMemoryRunner(agent=recovery_agent, app_name="bball_ref_agents_recovery")
        session = await runner.session_service.create_session(app_name=runner.app_name, user_id="backend")
        recovery_prompt = (
            "Return exactly one JSON object with keys: level, confidence, rule_reference, summary, rationale.\n"
            "Do not include markdown or any extra text.\n\n"
            "Original session prompt:\n"
            f"{prompt}\n\n"
            "Recent model output (may be incomplete/non-final):\n"
            f"{prior_text or 'none'}\n"
        )
        if constraint_note:
            recovery_prompt += f"\nAdditional hard constraints:\n{constraint_note}\n"
        user_message = types.Content(role="user", parts=[types.Part.from_text(text=recovery_prompt)])

        last_text: str | None = None
        final_decision_payload: dict | None = None
        try:
            async for event in runner.run_async(
                user_id=session.user_id,
                session_id=session.id,
                new_message=user_message,
            ):
                actions = getattr(event, "actions", None)
                state_delta = getattr(actions, "state_delta", None) if actions else None
                if isinstance(state_delta, dict):
                    payload = state_delta.get("final_decision")
                    if isinstance(payload, dict) and _is_final_decision_shape(payload):
                        final_decision_payload = payload
                    elif isinstance(payload, str):
                        try:
                            parsed = json.loads(_extract_json_object(payload))
                            if _is_final_decision_shape(parsed):
                                final_decision_payload = parsed
                        except Exception:
                            pass

                if not event.content or not event.content.parts:
                    continue
                merged_text = "\n".join(part.text for part in event.content.parts if part.text)
                if merged_text:
                    last_text = merged_text
        finally:
            await runner.close()
        return last_text, final_decision_payload

    async def _run_agent_attempt(
        self,
        prompt: str,
        model_config: AgentModelConfig,
    ) -> tuple[str | None, dict | None]:
        agent = build_agent_tree(model_config=model_config)
        runner = InMemoryRunner(agent=agent, app_name="bball_ref_agents")
        session = await runner.session_service.create_session(app_name=runner.app_name, user_id="backend")
        user_message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])

        last_text: str | None = None
        json_text_candidate: str | None = None
        running_text_buffer: list[str] = []
        final_decision_payload: dict | None = None
        try:
            async for event in runner.run_async(
                user_id=session.user_id,
                session_id=session.id,
                new_message=user_message,
            ):
                actions = getattr(event, "actions", None)
                state_delta = getattr(actions, "state_delta", None) if actions else None
                if isinstance(state_delta, dict):
                    payload = state_delta.get("final_decision")
                    if isinstance(payload, dict):
                        final_decision_payload = payload
                    elif isinstance(payload, str):
                        try:
                            final_decision_payload = json.loads(_extract_json_object(payload))
                        except Exception:
                            pass

                if not event.content or not event.content.parts:
                    continue
                merged_text = "\n".join(part.text for part in event.content.parts if part.text)
                if merged_text:
                    last_text = merged_text
                    running_text_buffer.append(merged_text)
                    if json_text_candidate is None:
                        try:
                            parsed = json.loads(_extract_json_object(merged_text))
                            if _is_final_decision_shape(parsed):
                                json_text_candidate = json.dumps(parsed)
                        except Exception:
                            try:
                                parsed = json.loads(_extract_json_object("\n".join(running_text_buffer)))
                                if _is_final_decision_shape(parsed):
                                    json_text_candidate = json.dumps(parsed)
                            except Exception:
                                pass
        finally:
            await runner.close()
        return json_text_candidate or last_text, final_decision_payload

    async def analyze(
        self,
        session_id: str,
        angles: list[AngleMetadata],
        metadata_override: dict[str, Any] | None = None,
    ) -> AnalyzeSessionResponse:
        seeded_metadata = _metadata_from_override(metadata_override=metadata_override)
        session_input = SessionInput(
            session_id=session_id,
            clips=[
                ClipInput(
                    clip_id=angle.id,
                    angle_label=angle.label,
                    storage_path=angle.storage_path,
                )
                for angle in angles
            ],
            metadata=seeded_metadata,
        )
        prompt = build_session_prompt(session_input)
        last_text: str | None = None
        final_decision_payload: dict | None = None
        last_exc: Exception | None = None
        used_attempt: AgentModelConfig | None = None
        for attempt in _model_attempts():
            try:
                last_text, final_decision_payload = await self._run_agent_attempt(
                    prompt=prompt,
                    model_config=attempt,
                )
                used_attempt = attempt
                break
            except Exception as exc:
                last_exc = exc
                if not _is_retryable_model_error(exc):
                    raise
                await asyncio.sleep(_retry_after_seconds(exc))
                continue

        if last_text is None and last_exc is not None:
            # Degrade gracefully instead of bubbling a 500 for recoverable model/tool failures.
            last_text = f"Agent analysis fallback: {last_exc}"

        if not last_text:
            raise RuntimeError("Agent API returned no decision content")

        if final_decision_payload is not None:
            decision = FinalDecision.model_validate(final_decision_payload)
        else:
            try:
                decision = FinalDecision.model_validate(json.loads(_extract_json_object(last_text)))
            except Exception as exc:
                recovery_text, recovery_payload = await self._run_recovery_crew_chief(
                    prompt=prompt,
                    prior_text=last_text,
                    model_config=used_attempt or _model_attempts()[0],
                )
                if recovery_payload is not None:
                    decision = FinalDecision.model_validate(recovery_payload)
                else:
                    try:
                        decision = FinalDecision.model_validate(
                            json.loads(_extract_json_object(recovery_text or ""))
                        )
                    except Exception:
                        snippet = re.sub(r"\s+", " ", last_text).strip()
                        if len(snippet) > 300:
                            snippet = f"{snippet[:300]}..."
                        raise RuntimeError(
                            "Crew chief response was not valid FinalDecision JSON; "
                            f"raw response snippet: {snippet}"
                        ) from exc

        violations = _metadata_guardrail_violations(decision=decision, metadata=seeded_metadata)
        if violations:
            allowed_names = ", ".join(player.display_name for player in seeded_metadata.players_on_court if player.display_name)
            involved_names = ", ".join(
                player.display_name for player in seeded_metadata.involved_players if player.display_name
            )
            note = (
                "Use only these player names: "
                f"{allowed_names or 'none provided'}.\n"
                "You must explicitly mention these involved players: "
                f"{involved_names or 'none provided'}.\n"
                f"Fix these violations: {', '.join(violations[:8])}."
            )
            recovery_text, recovery_payload = await self._run_recovery_crew_chief(
                prompt=prompt,
                prior_text=json.dumps(decision.model_dump(mode='json')),
                model_config=used_attempt or _model_attempts()[0],
                constraint_note=note,
            )
            if recovery_payload is not None:
                decision = FinalDecision.model_validate(recovery_payload)
            else:
                decision = FinalDecision.model_validate(json.loads(_extract_json_object(recovery_text or "")))

            post_violations = _metadata_guardrail_violations(decision=decision, metadata=seeded_metadata)
            if post_violations:
                raise RuntimeError(
                    "Crew chief decision violated metadata grounding constraints: "
                    + ", ".join(post_violations[:8])
                )
        verdict = Verdict(
            level=_normalize_level(decision.level),
            confidence=decision.confidence,
            summary=decision.summary,
            rule_reference=decision.rule_reference,
            evidence=_extract_evidence_items(decision=decision, angles=angles),
        )
        return AnalyzeSessionResponse(session_id=session_id, verdict=verdict)
