from pathlib import Path

from fastapi import UploadFile

from app.config import Settings
from app.db.repositories.session_repo import SessionRepository
from app.schemas.session import AngleMetadata
from app.utils.storage import save_upload


class UploadService:
    def __init__(self, repo: SessionRepository, settings: Settings) -> None:
        self._repo = repo
        self._settings = settings

    async def save_angles(self, session_id: str, files: list[UploadFile]) -> list[AngleMetadata]:
        session_dir = self._settings.upload_dir / session_id
        angles: list[AngleMetadata] = []

        for idx, file in enumerate(files, start=1):
            file_name = file.filename or f"angle_{idx}.mp4"
            target_file_name = f"angle_{idx}_{file_name}"
            stored_path = await save_upload(session_dir=session_dir, upload=file, target_file_name=target_file_name)

            metadata = AngleMetadata(
                id=f"angle-{idx}",
                label=f"Angle {idx}",
                file_name=file_name,
                file_size=stored_path.stat().st_size,
                storage_path=str(Path(stored_path).as_posix()),
            )
            angles.append(metadata)

        self._repo.set_angles(session_id, angles)
        return angles
