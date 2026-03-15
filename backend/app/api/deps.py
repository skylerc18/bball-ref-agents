from app.config import get_settings
from app.db.repositories.session_repo import SessionRepository
from app.services.agents_client import AgentsClient
from app.services.review_orchestrator import ReviewOrchestrator
from app.services.session_service import SessionService
from app.services.upload_service import UploadService
from app.ws.manager import ConnectionManager

settings = get_settings()
repo = SessionRepository()
ws_manager = ConnectionManager()
agents_client = AgentsClient()

session_service = SessionService(repo=repo)
upload_service = UploadService(repo=repo, settings=settings)
review_orchestrator = ReviewOrchestrator(repo=repo, agents_client=agents_client, ws_manager=ws_manager)
