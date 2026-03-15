import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.utils.secrets import load_secret


class Settings(BaseSettings):
    app_name: str = "AI Basketball Ref Backend"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]
    upload_dir: Path = Path("backend/data/uploads")
    google_api_key: str | None = None
    gcp_project_id: str | None = None
    google_api_key_secret_id: str | None = None
    google_api_key_secret_version: str = "latest"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="BBREF_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    if not os.getenv("GOOGLE_API_KEY"):
        if settings.google_api_key:
            os.environ["GOOGLE_API_KEY"] = settings.google_api_key
        elif settings.gcp_project_id and settings.google_api_key_secret_id:
            os.environ["GOOGLE_API_KEY"] = load_secret(
                project_id=settings.gcp_project_id,
                secret_id=settings.google_api_key_secret_id,
                version=settings.google_api_key_secret_version,
            )
    return settings
