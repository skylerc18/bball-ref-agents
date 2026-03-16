import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.db.repositories.session_repo import SessionRepository, SessionRecord
from app.schemas.session import AngleMetadata, ExampleClipSummary, ExampleSummary

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = PROJECT_ROOT / "backend" / "app" / "fixtures" / "examples_catalog.json"


class ExampleService:
    def __init__(self, repo: SessionRepository) -> None:
        self._repo = repo

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_catalog() -> list[dict[str, Any]]:
        try:
            raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        except OSError as exc:
            raise RuntimeError(f"Examples catalog is not readable: {CATALOG_PATH}") from exc
        if not isinstance(raw, list):
            raise RuntimeError("Examples catalog must be a JSON array")
        return raw

    @staticmethod
    def _to_media_url(path_value: str) -> str:
        normalized = path_value.replace("\\", "/")
        marker = "media/"
        if marker in normalized:
            return f"/{normalized[normalized.index(marker):]}"
        return normalized

    def list_examples(self) -> list[ExampleSummary]:
        result: list[ExampleSummary] = []
        for entry in self._load_catalog():
            if not isinstance(entry, dict):
                continue
            clips = entry.get("clips")
            clip_count = len(clips) if isinstance(clips, list) else 0
            clip_summaries: list[ExampleClipSummary] = []
            if isinstance(clips, list):
                for idx, clip in enumerate(clips, start=1):
                    if not isinstance(clip, dict):
                        continue
                    clip_path = clip.get("path")
                    if not isinstance(clip_path, str) or not clip_path:
                        continue
                    clip_summaries.append(
                        ExampleClipSummary(
                            id=str(clip.get("id") or f"angle-{idx}"),
                            label=str(clip.get("label") or f"Angle {idx}"),
                            src_url=self._to_media_url(clip_path),
                        )
                    )
            result.append(
                ExampleSummary(
                    example_id=str(entry.get("example_id", "")),
                    title=str(entry.get("title", "Untitled example")),
                    description=entry.get("description"),
                    tags=[str(tag) for tag in entry.get("tags", []) if isinstance(tag, str)],
                    clip_count=clip_count,
                    clips=clip_summaries,
                )
            )
        return [item for item in result if item.example_id]

    def _get_example(self, example_id: str) -> dict[str, Any]:
        for entry in self._load_catalog():
            if isinstance(entry, dict) and entry.get("example_id") == example_id:
                return entry
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Example not found: {example_id}")

    def _resolve_project_path(self, path_value: str) -> Path:
        rel_path = Path(path_value)
        if rel_path.is_absolute():
            return rel_path
        return (PROJECT_ROOT / rel_path).resolve()

    def apply_example_to_session(self, session_id: str, example_id: str) -> SessionRecord:
        entry = self._get_example(example_id)

        metadata_path_value = entry.get("metadata_path")
        if not isinstance(metadata_path_value, str) or not metadata_path_value:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Example {example_id} is missing metadata_path",
            )
        metadata_path = self._resolve_project_path(metadata_path_value)
        if not metadata_path.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Metadata file not found for {example_id}: {metadata_path}",
            )

        try:
            metadata_payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid metadata JSON for {example_id}: {metadata_path}",
            ) from exc

        metadata_block = metadata_payload.get("metadata")
        if not isinstance(metadata_block, dict):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Metadata payload for {example_id} must include a 'metadata' object",
            )

        clips = entry.get("clips")
        if not isinstance(clips, list) or len(clips) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Example {example_id} has no configured clips",
            )

        angles: list[AngleMetadata] = []
        for idx, clip in enumerate(clips, start=1):
            if not isinstance(clip, dict):
                continue
            clip_path_value = clip.get("path")
            if not isinstance(clip_path_value, str) or not clip_path_value:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Example {example_id} clip {idx} is missing a path",
                )

            clip_path = self._resolve_project_path(clip_path_value)
            if not clip_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Example clip missing for {example_id}: {clip_path}",
                )

            angle_id = clip.get("id")
            angle_label = clip.get("label")
            angles.append(
                AngleMetadata(
                    id=str(angle_id) if isinstance(angle_id, str) and angle_id else f"angle-{idx}",
                    label=str(angle_label) if isinstance(angle_label, str) and angle_label else f"Angle {idx}",
                    file_name=clip_path.name,
                    file_size=clip_path.stat().st_size,
                    storage_path=clip_path.as_posix(),
                )
            )

        if not angles:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Example {example_id} contains no valid clip definitions",
            )

        self._repo.set_angles(session_id=session_id, angles=angles)
        self._repo.set_context_metadata(session_id=session_id, metadata=metadata_block)
        record = self._repo.get(session_id=session_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found after applying example: {session_id}",
            )
        return record
