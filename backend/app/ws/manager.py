from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        if session_id in self._connections and websocket in self._connections[session_id]:
            self._connections[session_id].remove(websocket)
        if session_id in self._connections and not self._connections[session_id]:
            del self._connections[session_id]

    async def broadcast(self, session_id: str, message: dict) -> None:
        for connection in list(self._connections.get(session_id, [])):
            await connection.send_json(message)
