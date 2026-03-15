from agents.adk_compat import Agent
from agents.crew_chief import build_crew_chief_agent
from agents.specialists import build_specialist_agents
from models.settings import AgentModelConfig
from prompts.instructions import SESSION_ORCHESTRATOR_PROMPT


def build_session_orchestrator_agent(model_config: AgentModelConfig | None = None) -> Agent:
    config = model_config or AgentModelConfig()
    specialists = build_specialist_agents(config)
    crew_chief = build_crew_chief_agent(config)

    return Agent(
        name="session_orchestrator_agent",
        model=config.orchestrator_model,
        instruction=SESSION_ORCHESTRATOR_PROMPT,
        description="Manages session metadata, plans analysis sequence, and delegates to specialist subagents.",
        sub_agents=[*specialists, crew_chief],
        output_key="session_analysis",
    )
