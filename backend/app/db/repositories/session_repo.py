from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas.session import AngleMetadata, SessionStatus
from app.schemas.verdict import Verdict


@dataclass
class SessionRecord:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    status: SessionStatus = SessionStatus.idle
    angles: list[AngleMetadata] = field(default_factory=list)
    verdict: Verdict | None = None


class SessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}

    def create(self, session_id: str) -> SessionRecord:
        record = SessionRecord(id=session_id)
        self._sessions[session_id] = record
        return record

    def get(self, session_id: str) -> SessionRecord | None:
        return self._sessions.get(session_id)

    def set_status(self, session_id: str, status: SessionStatus) -> SessionRecord:
        record = self._sessions[session_id]
        record.status = status
        return record

    def set_angles(self, session_id: str, angles: list[AngleMetadata]) -> SessionRecord:
        record = self._sessions[session_id]
        record.angles = angles
        return record

    def set_verdict(self, session_id: str, verdict: Verdict) -> SessionRecord:
        record = self._sessions[session_id]
        record.verdict = verdict
        return record
