from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import example_service, repo, review_orchestrator, session_service, upload_service
from app.schemas.session import (
    ListExamplesResponse,
    SessionCreateResponse,
    SessionReadResponse,
    SessionStatus,
    UploadAnglesResponse,
)
from app.schemas.verdict import AnalyzeSessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/examples", response_model=ListExamplesResponse)
async def list_examples() -> ListExamplesResponse:
    return ListExamplesResponse(examples=example_service.list_examples())


@router.post("", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_session() -> SessionCreateResponse:
    record = session_service.create_session()
    return SessionCreateResponse(id=record.id, created_at=record.created_at, status=record.status)


@router.get("/{session_id}", response_model=SessionReadResponse)
async def get_session(session_id: str) -> SessionReadResponse:
    record = session_service.get_required(session_id)
    return SessionReadResponse(
        id=record.id,
        created_at=record.created_at,
        status=record.status,
        angles=record.angles,
    )


@router.post("/{session_id}/angles", response_model=UploadAnglesResponse)
async def upload_angles(session_id: str, files: list[UploadFile] = File(...)) -> UploadAnglesResponse:
    if len(files) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    session_service.get_required(session_id)
    session_service.set_status(session_id, SessionStatus.uploading)

    angles = await upload_service.save_angles(session_id=session_id, files=files)
    session_service.set_status(session_id, SessionStatus.idle)

    return UploadAnglesResponse(uploaded_count=len(angles))


@router.post("/{session_id}/analyze", response_model=AnalyzeSessionResponse)
async def analyze_session(session_id: str) -> AnalyzeSessionResponse:
    record = repo.get(session_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not record.angles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload angles before analysis")

    result = await review_orchestrator.analyze(session_id=session_id)
    return result


@router.post("/from-example/{example_id}", response_model=SessionReadResponse, status_code=status.HTTP_201_CREATED)
async def create_session_from_example(example_id: str) -> SessionReadResponse:
    record = session_service.create_session()
    hydrated = example_service.apply_example_to_session(session_id=record.id, example_id=example_id)
    return SessionReadResponse(
        id=hydrated.id,
        created_at=hydrated.created_at,
        status=hydrated.status,
        angles=hydrated.angles,
    )
