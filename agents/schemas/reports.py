from pydantic import BaseModel, Field


class SpecialistFinding(BaseModel):
    timestamp_sec: float
    confidence: float = Field(ge=0, le=1)
    detail: str


class SpecialistReport(BaseModel):
    agent_name: str
    clip_id: str
    findings: list[SpecialistFinding] = Field(default_factory=list)
    summary: str


class FinalDecision(BaseModel):
    level: str
    confidence: float = Field(ge=0, le=1)
    rule_reference: str
    summary: str
    rationale: list[str] = Field(default_factory=list)
