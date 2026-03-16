from typing import Literal, Union

from pydantic import BaseModel

from app.schemas.realtime import RealtimeMessage
from app.schemas.session import SessionStatus
from app.schemas.verdict import AnalyzeSessionResponse


class SessionStatusPayload(BaseModel):
    session_id: str
    status: SessionStatus


class AnalysisProgressPayload(BaseModel):
    session_id: str
    progress: int


class SessionStatusMessage(BaseModel):
    type: Literal["session.status"]
    payload: SessionStatusPayload


class AnalysisProgressMessage(BaseModel):
    type: Literal["analysis.progress"]
    payload: AnalysisProgressPayload


class AnalysisDoneMessage(BaseModel):
    type: Literal["analysis.done"]
    payload: AnalyzeSessionResponse


WsMessage = Union[SessionStatusMessage, AnalysisProgressMessage, AnalysisDoneMessage, RealtimeMessage]
