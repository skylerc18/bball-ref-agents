from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import SessionStatus
from app.schemas.verdict import AnalyzeSessionResponse
from app.services.agents_client import AgentsClient
from app.ws.manager import ConnectionManager


class ReviewOrchestrator:
    def __init__(
        self,
        repo: SessionRepository,
        agents_client: AgentsClient,
        ws_manager: ConnectionManager,
    ) -> None:
        self._repo = repo
        self._agents_client = agents_client
        self._ws_manager = ws_manager

    async def analyze(self, session_id: str) -> AnalyzeSessionResponse:
        session = self._repo.get(session_id)
        if session is None:
            raise ValueError("Session not found")

        self._repo.set_status(session_id, SessionStatus.processing)
        await self._ws_manager.broadcast(
            session_id,
            {
                "type": "session.status",
                "payload": {"session_id": session_id, "status": SessionStatus.processing},
            },
        )

        for progress in (15, 45, 75):
            await self._ws_manager.broadcast(
                session_id,
                {
                    "type": "analysis.progress",
                    "payload": {"session_id": session_id, "progress": progress},
                },
            )

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
            raise

        self._repo.set_verdict(session_id, result.verdict)
        self._repo.set_status(session_id, SessionStatus.complete)

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

        return result
