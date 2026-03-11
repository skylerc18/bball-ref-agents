import asyncio

from app.schemas.session import AngleMetadata
from app.schemas.verdict import AnalyzeSessionResponse, EvidenceItem, Verdict


class AgentsClient:
    async def analyze(self, session_id: str, angles: list[AngleMetadata]) -> AnalyzeSessionResponse:
        # Placeholder for real agents/workflow call.
        await asyncio.sleep(1.0)

        primary_angle_id = angles[0].id if angles else "angle-1"

        verdict = Verdict(
            level="upheld",
            confidence=0.84,
            summary="Defender established legal guarding position before contact.",
            rule_reference="NFHS Rule 4-23",
            evidence=[
                EvidenceItem(
                    id=f"{session_id}_ev_1",
                    angle_id=primary_angle_id,
                    timestamp_sec=3.2,
                    confidence=0.87,
                    reason="Lead foot set before torso displacement.",
                )
            ],
        )

        return AnalyzeSessionResponse(session_id=session_id, verdict=verdict)
