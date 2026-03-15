import json
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.api.deps import repo, review_orchestrator, ws_manager
from app.schemas.realtime import UserInterruptRequestMessage

router = APIRouter(prefix="/ws", tags=["ws"])


@router.websocket("/sessions/{session_id}")
async def session_events(websocket: WebSocket, session_id: str) -> None:
    await ws_manager.connect(session_id=session_id, websocket=websocket)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                client_message = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "ws.error", "payload": {"code": "invalid_json", "detail": "Malformed JSON"}}
                )
                continue

            try:
                parsed = UserInterruptRequestMessage.model_validate(client_message)
            except ValidationError as exc:
                await websocket.send_json(
                    {
                        "type": "ws.error",
                        "payload": {"code": "invalid_payload", "detail": "Invalid user.interrupt payload", "errors": exc.errors()},
                    }
                )
                continue

            payload = parsed.payload

            if repo.get(session_id) is None:
                continue

            turn_id = payload.turn_id.strip()
            utterance_id = payload.utterance_id.strip()
            if not turn_id or not utterance_id:
                continue

            await review_orchestrator.handle_user_interrupt(
                session_id=session_id,
                turn_id=turn_id,
                utterance_id=utterance_id,
                interruption_id=payload.interruption_id or f"intr_{uuid4().hex[:12]}",
                intent=payload.intent,
                transcript=payload.transcript,
            )
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id=session_id, websocket=websocket)
