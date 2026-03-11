from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Basketball Ref Backend"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]
    upload_dir: Path = Path("backend/data/uploads")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="BBREF_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings
