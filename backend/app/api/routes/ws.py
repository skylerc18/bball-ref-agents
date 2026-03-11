from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import ws_manager

router = APIRouter(prefix="/ws", tags=["ws"])


@router.websocket("/sessions/{session_id}")
async def session_events(websocket: WebSocket, session_id: str) -> None:
    await ws_manager.connect(session_id=session_id, websocket=websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id=session_id, websocket=websocket)
