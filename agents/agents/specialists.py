from agents.adk_compat import Agent
from models.settings import AgentModelConfig
from prompts.instructions import (
    ANGLE_ANALYST_PROMPT,
    BALL_TRACKING_PROMPT,
    BOUNDARY_PROMPT,
    CONTACT_DETECTION_PROMPT,
    TIMING_PROMPT,
)


def build_specialist_agents(model_config: AgentModelConfig) -> list[Agent]:
    return [
        Agent(
            name="contact_detection_agent",
            model=model_config.specialist_model,
            instruction=CONTACT_DETECTION_PROMPT,
            description="Detects and classifies contact events.",
            output_key="contact_report",
        ),
        Agent(
            name="ball_tracking_agent",
            model=model_config.specialist_model,
            instruction=BALL_TRACKING_PROMPT,
            description="Tracks ball movement and possession transitions.",
            output_key="ball_tracking_report",
        ),
        Agent(
            name="timing_agent",
            model=model_config.specialist_model,
            instruction=TIMING_PROMPT,
            description="Evaluates timing-dependent rule events.",
            output_key="timing_report",
        ),
        Agent(
            name="angle_analyst_agent",
            model=model_config.specialist_model,
            instruction=ANGLE_ANALYST_PROMPT,
            description="Assesses camera-angle reliability and visibility.",
            output_key="angle_report",
        ),
        Agent(
            name="boundary_agent",
            model=model_config.specialist_model,
            instruction=BOUNDARY_PROMPT,
            description="Evaluates relation to lines, boundaries, and restricted area.",
            output_key="boundary_report",
        ),
    ]
