from pydantic import BaseModel, Field


class AgentModelConfig(BaseModel):
    orchestrator_model: str = Field(default="gemini-2.5-flash")
    specialist_model: str = Field(default="gemini-2.5-flash")
    crew_chief_model: str = Field(default="gemini-2.5-pro")
