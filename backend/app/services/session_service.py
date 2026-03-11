from uuid import uuid4

from fastapi import HTTPException, status

from app.db.repositories.session_repo import SessionRepository, SessionRecord
from app.schemas.session import SessionStatus


class SessionService:
    def __init__(self, repo: SessionRepository) -> None:
        self._repo = repo

    def create_session(self) -> SessionRecord:
        return self._repo.create(session_id=f"session_{uuid4().hex[:10]}")

    def get_required(self, session_id: str) -> SessionRecord:
        record = self._repo.get(session_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        return record

    def set_status(self, session_id: str, status_value: SessionStatus) -> SessionRecord:
        self.get_required(session_id)
        return self._repo.set_status(session_id, status_value)
