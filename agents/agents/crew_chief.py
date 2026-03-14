from agents.adk_compat import Agent
from models.settings import AgentModelConfig
from prompts.instructions import CREW_CHIEF_PROMPT


def build_crew_chief_agent(model_config: AgentModelConfig) -> Agent:
    return Agent(
        name="crew_chief_agent",
        model=model_config.crew_chief_model,
        instruction=CREW_CHIEF_PROMPT,
        description="Synthesizes specialist evidence into the final officiating decision.",
        output_key="final_decision",
    )
