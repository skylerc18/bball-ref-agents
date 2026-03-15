import json
import sqlite3
from pathlib import Path
from threading import RLock
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas.session import AngleMetadata, SessionStatus
from app.schemas.verdict import Verdict


@dataclass
class TurnRecord:
    turn_id: str
    state: str
    verdict_id: str | None = None
    transcript: str = ""
    interrupted: bool = False
    interruption_intent: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SessionRecord:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    status: SessionStatus = SessionStatus.idle
    angles: list[AngleMetadata] = field(default_factory=list)
    verdict: Verdict | None = None
    turn_counter: int = 0
    turns: dict[str, TurnRecord] = field(default_factory=dict)


class SessionRepository:
    def __init__(self, db_path: Path | str = "backend/data/sessions.db") -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._conn = sqlite3.connect(self._db_path.as_posix(), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    angles_json TEXT NOT NULL,
                    verdict_json TEXT,
                    turn_counter INTEGER NOT NULL DEFAULT 0,
                    turns_json TEXT NOT NULL
                )
                """
            )

    def _row_to_record(self, row: sqlite3.Row) -> SessionRecord:
        angles_data = json.loads(row["angles_json"]) if row["angles_json"] else []
        turns_data = json.loads(row["turns_json"]) if row["turns_json"] else {}
        verdict_data = json.loads(row["verdict_json"]) if row["verdict_json"] else None

        turns: dict[str, TurnRecord] = {}
        for turn_id, value in turns_data.items():
            turns[turn_id] = TurnRecord(
                turn_id=turn_id,
                state=str(value.get("state", "collecting")),
                verdict_id=value.get("verdict_id"),
                transcript=str(value.get("transcript", "")),
                interrupted=bool(value.get("interrupted", False)),
                interruption_intent=value.get("interruption_intent"),
                updated_at=datetime.fromisoformat(value.get("updated_at"))
                if value.get("updated_at")
                else datetime.now(timezone.utc),
            )

        return SessionRecord(
            id=row["id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            status=SessionStatus(row["status"]),
            angles=[AngleMetadata.model_validate(item) for item in angles_data],
            verdict=Verdict.model_validate(verdict_data) if verdict_data else None,
            turn_counter=int(row["turn_counter"]),
            turns=turns,
        )

    def _save_record(self, record: SessionRecord) -> None:
        turns_json = {
            turn_id: {
                "state": turn.state,
                "verdict_id": turn.verdict_id,
                "transcript": turn.transcript,
                "interrupted": turn.interrupted,
                "interruption_intent": turn.interruption_intent,
                "updated_at": turn.updated_at.isoformat(),
            }
            for turn_id, turn in record.turns.items()
        }
        with self._conn:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO sessions
                (id, created_at, status, angles_json, verdict_json, turn_counter, turns_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.created_at.isoformat(),
                    record.status.value,
                    json.dumps([item.model_dump(mode="json") for item in record.angles]),
                    json.dumps(record.verdict.model_dump(mode="json")) if record.verdict else None,
                    record.turn_counter,
                    json.dumps(turns_json),
                ),
            )

    def _get_unlocked(self, session_id: str) -> SessionRecord | None:
        row = self._conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        return self._row_to_record(row) if row else None

    def create(self, session_id: str) -> SessionRecord:
        with self._lock:
            record = SessionRecord(id=session_id)
            self._save_record(record)
            return record

    def get(self, session_id: str) -> SessionRecord | None:
        with self._lock:
            return self._get_unlocked(session_id)

    def set_status(self, session_id: str, status: SessionStatus) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            record.status = status
            self._save_record(record)
            return record

    def set_angles(self, session_id: str, angles: list[AngleMetadata]) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            record.angles = angles
            self._save_record(record)
            return record

    def set_verdict(self, session_id: str, verdict: Verdict) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            record.verdict = verdict
            self._save_record(record)
            return record

    def next_turn_id(self, session_id: str) -> str:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            record.turn_counter += 1
            turn_id = f"turn_{record.turn_counter:04d}"
            record.turns[turn_id] = TurnRecord(turn_id=turn_id, state="collecting")
            self._save_record(record)
            return turn_id

    def set_turn_state(self, session_id: str, turn_id: str, state: str) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            turn = record.turns.setdefault(turn_id, TurnRecord(turn_id=turn_id, state=state))
            turn.state = state
            turn.updated_at = datetime.now(timezone.utc)
            self._save_record(record)
            return record

    def set_turn_verdict(self, session_id: str, turn_id: str, verdict_id: str) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            turn = record.turns.setdefault(turn_id, TurnRecord(turn_id=turn_id, state="committed"))
            turn.verdict_id = verdict_id
            turn.updated_at = datetime.now(timezone.utc)
            self._save_record(record)
            return record

    def get_turn_state(self, session_id: str, turn_id: str) -> str | None:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                return None
            turn = record.turns.get(turn_id)
            if turn is None:
                return None
            return turn.state

    def append_turn_transcript(self, session_id: str, turn_id: str, text: str) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            turn = record.turns.setdefault(turn_id, TurnRecord(turn_id=turn_id, state="speaking"))
            turn.transcript = " ".join([turn.transcript, text]).strip()
            turn.updated_at = datetime.now(timezone.utc)
            self._save_record(record)
            return record

    def mark_turn_interrupted(self, session_id: str, turn_id: str, intent: str) -> SessionRecord:
        with self._lock:
            record = self._get_unlocked(session_id)
            if record is None:
                raise KeyError(session_id)
            turn = record.turns.setdefault(turn_id, TurnRecord(turn_id=turn_id, state="interrupted"))
            turn.state = "interrupted"
            turn.interrupted = True
            turn.interruption_intent = intent
            turn.updated_at = datetime.now(timezone.utc)
            self._save_record(record)
            return record
