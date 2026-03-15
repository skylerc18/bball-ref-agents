from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from app.schemas.session import AngleMetadata
from app.schemas.verdict import AnalyzeSessionResponse, Verdict, VerdictLevel

AGENTS_ROOT = Path(__file__).resolve().parents[3] / "agents"
if str(AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENTS_ROOT))

from google.adk.runners import InMemoryRunner
from google.genai import types
from schemas.reports import FinalDecision
from schemas.session import ClipInput, SessionInput
from workflows.session_workflow import build_agent_tree, build_session_prompt


def _extract_json_object(text: str) -> str:
    raw = text.strip()
    if raw.startswith("{") and raw.endswith("}"):
        return raw

    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("No JSON object found in agent response")


def _normalize_level(level: str) -> VerdictLevel:
    normalized = level.strip().lower()
    if normalized in {VerdictLevel.upheld.value, VerdictLevel.overruled.value, VerdictLevel.inconclusive.value}:
        return VerdictLevel(normalized)
    return VerdictLevel.inconclusive


def _fallback_decision(raw_text: str) -> FinalDecision:
    summary = re.sub(r"\s+", " ", raw_text).strip()
    if len(summary) > 280:
        summary = f"{summary[:277]}..."
    return FinalDecision(
        level=VerdictLevel.inconclusive.value,
        confidence=0.35,
        rule_reference="N/A",
        summary=summary or "Agent response was not in the expected structured format.",
        rationale=[],
    )


class AgentsClient:
    async def analyze(self, session_id: str, angles: list[AngleMetadata]) -> AnalyzeSessionResponse:
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
        )
        prompt = build_session_prompt(session_input)
        agent = build_agent_tree()
        runner = InMemoryRunner(agent=agent, app_name="bball_ref_agents")

        session = await runner.session_service.create_session(app_name=runner.app_name, user_id="backend")
        user_message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])

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
        finally:
            await runner.close()

        if not last_text:
            raise RuntimeError("Agent API returned no decision content")

        if final_decision_payload is not None:
            decision = FinalDecision.model_validate(final_decision_payload)
        else:
            try:
                decision = FinalDecision.model_validate(json.loads(_extract_json_object(last_text)))
            except Exception:
                decision = _fallback_decision(last_text)
        verdict = Verdict(
            level=_normalize_level(decision.level),
            confidence=decision.confidence,
            summary=decision.summary,
            rule_reference=decision.rule_reference,
            evidence=[],
        )
        return AnalyzeSessionResponse(session_id=session_id, verdict=verdict)
