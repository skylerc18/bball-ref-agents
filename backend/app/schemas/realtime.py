from enum import Enum
from typing import Literal, Union

from pydantic import BaseModel, Field

from app.schemas.verdict import VerdictLevel


class AgentName(str, Enum):
    session_orchestrator = "session_orchestrator"
    crew_chief = "crew_chief"
    contact_detection = "contact_detection"
    ball_tracking = "ball_tracking"
    timing = "timing"


class TurnState(str, Enum):
    collecting = "collecting"
    deliberating = "deliberating"
    committed = "committed"
    speaking = "speaking"
    interrupted = "interrupted"
    done = "done"


class FindingType(str, Enum):
    contact = "contact"
    ball_position = "ball_position"
    clock_event = "clock_event"
    rule_context = "rule_context"


class EvidenceRef(BaseModel):
    angle_id: str
    timestamp_sec: float = Field(ge=0)
    clip_start_sec: float | None = Field(default=None, ge=0)
    clip_end_sec: float | None = Field(default=None, ge=0)


class FindingPayload(BaseModel):
    session_id: str
    turn_id: str
    finding_id: str
    source_agent: AgentName
    finding_type: FindingType
    value: str
    confidence: float = Field(ge=0, le=1)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    version: int = Field(ge=1)


class TurnStatusPayload(BaseModel):
    session_id: str
    turn_id: str
    state: TurnState
    reason: str | None = None


class VerdictClaim(BaseModel):
    level: VerdictLevel
    summary: str
    rule_reference: str
    confidence: float = Field(ge=0, le=1)


class CommittedVerdictPayload(BaseModel):
    session_id: str
    turn_id: str
    verdict_id: str
    claim: VerdictClaim
    rationale_points: list[str] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    committed_at: str


class SpeechChunkPayload(BaseModel):
    session_id: str
    turn_id: str
    verdict_id: str
    utterance_id: str
    chunk_index: int = Field(ge=0)
    text: str
    is_final_chunk: bool


class SpeechAudioChunkPayload(BaseModel):
    session_id: str
    turn_id: str
    verdict_id: str
    utterance_id: str
    chunk_index: int = Field(ge=0)
    audio_base64: str
    mime_type: str = "audio/pcm;rate=24000"
    sample_rate_hz: int = 24000


class UserInterruptionPayload(BaseModel):
    session_id: str
    turn_id: str
    utterance_id: str
    interruption_id: str
    intent: Literal["challenge", "clarify", "counterfactual", "new_angle", "other"]
    transcript: str
    interrupted_at: str


class UserInterruptRequestPayload(BaseModel):
    turn_id: str
    utterance_id: str
    interruption_id: str | None = None
    intent: Literal["challenge", "clarify", "counterfactual", "new_angle", "other"]
    transcript: str = ""


class UserInterruptRequestMessage(BaseModel):
    type: Literal["user.interrupt"]
    payload: UserInterruptRequestPayload


class FindingDeltaMessage(BaseModel):
    type: Literal["finding.delta"]
    payload: FindingPayload


class FindingFinalMessage(BaseModel):
    type: Literal["finding.final"]
    payload: FindingPayload


class TurnStatusMessage(BaseModel):
    type: Literal["turn.status"]
    payload: TurnStatusPayload


class VerdictCommittedMessage(BaseModel):
    type: Literal["verdict.committed"]
    payload: CommittedVerdictPayload


class SpeechStartMessage(BaseModel):
    type: Literal["speech.start"]
    payload: SpeechChunkPayload


class SpeechChunkMessage(BaseModel):
    type: Literal["speech.chunk"]
    payload: SpeechChunkPayload


class SpeechEndMessage(BaseModel):
    type: Literal["speech.end"]
    payload: SpeechChunkPayload


class SpeechAudioChunkMessage(BaseModel):
    type: Literal["speech.audio.chunk"]
    payload: SpeechAudioChunkPayload


class UserInterruptedMessage(BaseModel):
    type: Literal["user.interrupted"]
    payload: UserInterruptionPayload


RealtimeMessage = Union[
    FindingDeltaMessage,
    FindingFinalMessage,
    TurnStatusMessage,
    VerdictCommittedMessage,
    SpeechStartMessage,
    SpeechChunkMessage,
    SpeechEndMessage,
    SpeechAudioChunkMessage,
    UserInterruptedMessage,
]
