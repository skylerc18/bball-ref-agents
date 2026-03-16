from agents.session_orchestrator import build_session_orchestrator_agent
from models.settings import AgentModelConfig
from schemas.session import SessionInput


def build_agent_tree(model_config: AgentModelConfig | None = None) -> object:
    return build_session_orchestrator_agent(model_config=model_config)


def build_session_prompt(session: SessionInput) -> str:
    clip_lines = "\n".join(f"- {clip.clip_id}: {clip.angle_label} ({clip.storage_path})" for clip in session.clips)
    metadata = session.metadata
    players_on_court = (
        "\n".join(
            f"- {player.display_name} ({player.player_id})"
            + (f" #{player.jersey_number}" if player.jersey_number else "")
            + (f", team={player.team}" if player.team else "")
            for player in metadata.players_on_court
        )
        if metadata.players_on_court
        else "- none"
    )
    players_involved = ", ".join(metadata.players_involved_in_play) if metadata.players_involved_in_play else "none"

    return (
        f"Session ID: {session.session_id}\n"
        f"Review question: {session.review_question}\n"
        "Session metadata:\n"
        f"- game clock: {metadata.game_clock or 'unknown'}\n"
        f"- shot clock: {metadata.shot_clock or 'unknown'}\n"
        f"- period: {metadata.period or 'unknown'}\n"
        f"- possession team: {metadata.possession_team or 'unknown'}\n"
        f"- score context: {metadata.score_context or 'unknown'}\n"
        f"- players involved in play: {players_involved}\n"
        "Players on court:\n"
        f"{players_on_court}\n"
        "Uploaded clips:\n"
        f"{clip_lines if clip_lines else '- none'}"
    )
