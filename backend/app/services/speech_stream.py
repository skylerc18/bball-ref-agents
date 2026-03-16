import asyncio


class SpeechStreamManager:
    def __init__(self) -> None:
        self._tasks: dict[tuple[str, str], asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

    async def register(self, session_id: str, turn_id: str, task: asyncio.Task[None]) -> None:
        async with self._lock:
            self._tasks[(session_id, turn_id)] = task

    async def clear(self, session_id: str, turn_id: str, task: asyncio.Task[None]) -> None:
        async with self._lock:
            key = (session_id, turn_id)
            active = self._tasks.get(key)
            if active is task:
                self._tasks.pop(key, None)

    async def cancel(self, session_id: str, turn_id: str) -> bool:
        async with self._lock:
            task = self._tasks.get((session_id, turn_id))
            if task is None:
                return False
            task.cancel()
            return True
