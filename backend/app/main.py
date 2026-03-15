from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.sessions import router as sessions_router
from app.api.routes.ws import router as ws_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health-check", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(sessions_router, prefix=settings.api_prefix)
app.include_router(ws_router)
