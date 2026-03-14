from pydantic import BaseModel, Field


class ClipInput(BaseModel):
    clip_id: str
    angle_label: str
    storage_path: str
    frame_rate: float | None = None


class PlayerContext(BaseModel):
    player_id: str
    display_name: str
    team: str | None = None
    jersey_number: str | None = None
    on_court: bool = True


class SessionMetadata(BaseModel):
    players_on_court: list[PlayerContext] = Field(default_factory=list)
    players_involved_in_play: list[str] = Field(default_factory=list)
    game_clock: str | None = None
    shot_clock: str | None = None
    period: str | None = None
    score_context: str | None = None
    possession_team: str | None = None


class SessionInput(BaseModel):
    session_id: str
    clips: list[ClipInput] = Field(default_factory=list)
    metadata: SessionMetadata = Field(default_factory=SessionMetadata)
    review_question: str = "Determine the correct officiating call for the play."
