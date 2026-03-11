from pathlib import Path

from fastapi import UploadFile


async def save_upload(session_dir: Path, upload: UploadFile, target_file_name: str) -> Path:
    session_dir.mkdir(parents=True, exist_ok=True)
    destination = session_dir / target_file_name

    with destination.open("wb") as out:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    await upload.close()
    return destination
