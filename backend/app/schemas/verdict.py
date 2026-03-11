from enum import Enum

from pydantic import BaseModel, Field


class VerdictLevel(str, Enum):
    upheld = "upheld"
    overruled = "overruled"
    inconclusive = "inconclusive"


class EvidenceItem(BaseModel):
    id: str
    angle_id: str
    timestamp_sec: float
    confidence: float
    reason: str


class Verdict(BaseModel):
    level: VerdictLevel
    confidence: float = Field(ge=0, le=1)
    summary: str
    rule_reference: str
    evidence: list[EvidenceItem] = Field(default_factory=list)


class AnalyzeSessionResponse(BaseModel):
    session_id: str
    verdict: Verdict
