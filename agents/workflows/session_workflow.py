from agents.session_orchestrator import build_session_orchestrator_agent
from models.settings import AgentModelConfig
from schemas.session import SessionInput


def build_agent_tree(model_config: AgentModelConfig | None = None) -> object:
    return build_session_orchestrator_agent(model_config=model_config)


def build_session_prompt(session: SessionInput) -> str:
    clip_lines = "\n".join(f"- {clip.clip_id}: {clip.angle_label} ({clip.storage_path})" for clip in session.clips)
    metadata = session.metadata
    period_value = metadata.game.period or metadata.period or "unknown"
    game_clock_value = metadata.game.period_time_remaining or metadata.game_clock or "unknown"
    score_context_value = metadata.game.score_context or metadata.score_context or "unknown"
    possession_team_value = metadata.game.possession_team or metadata.possession_team or "unknown"
    game_header = (
        f"{metadata.game.away_team or 'Away'} at {metadata.game.home_team or 'Home'}"
        if metadata.game.home_team or metadata.game.away_team
        else "unknown"
    )
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
    involved_players = (
        "\n".join(
            f"- {player.display_name} ({player.player_id})"
            + (f", team={player.team}" if player.team else "")
            + (f", role={player.role_in_play}" if player.role_in_play else "")
            for player in metadata.involved_players
        )
        if metadata.involved_players
        else "- none"
    )
    players_involved_legacy = (
        ", ".join(metadata.players_involved_in_play) if metadata.players_involved_in_play else "none"
    )
    allowed_team_names = ", ".join(
        sorted({team for team in (metadata.game.home_team, metadata.game.away_team) if team})
    ) or "unknown"
    allowed_player_names = ", ".join(player.display_name for player in metadata.players_on_court) or "none"

    return (
        f"Session ID: {session.session_id}\n"
        f"Review question: {session.review_question}\n"
        "Session metadata:\n"
        f"- game: {game_header}\n"
        f"- game id: {metadata.game.game_id or 'unknown'}\n"
        f"- game date: {metadata.game.game_date or 'unknown'}\n"
        f"- game clock: {game_clock_value}\n"
        f"- shot clock: {metadata.shot_clock or 'unknown'}\n"
        f"- period: {period_value}\n"
        f"- possession team: {possession_team_value}\n"
        f"- score context: {score_context_value}\n"
        f"- call in question: {metadata.call.call_type or 'unknown'}\n"
        f"- ruling on floor: {metadata.call.ruling_on_floor or 'unknown'}\n"
        f"- whistle time: {metadata.call.whistle_time or 'unknown'}\n"
        f"- review trigger: {metadata.call.review_trigger or 'unknown'}\n"
        f"- legacy players involved in play: {players_involved_legacy}\n"
        "Players directly involved in this play:\n"
        f"{involved_players}\n"
        "Players on court:\n"
        f"{players_on_court}\n"
        "Decision constraints:\n"
        f"- allowed teams: {allowed_team_names}\n"
        f"- allowed player names: {allowed_player_names}\n"
        "- do not mention players or teams not listed above\n"
        f"- preserve floor-call context exactly as provided in ruling on floor: {metadata.call.ruling_on_floor or 'unknown'}\n"
        "- final ruling may differ from floor call only when supported by replay evidence and rule criteria\n"
        "- if final ruling differs, explicitly state both floor call and final ruling\n"
        "- use explicit team and player names from metadata for key actors\n"
        "- avoid generic labels like offensive player, defensive player, or defensive team\n"
        "- do not use jersey-color labels like player in white jersey or player in black jersey\n"
        "- for the main call action, name the specific involved players from metadata\n"
        "- use first-person referee voice only; do not narrate the ruling in third person\n"
        "Uploaded clips:\n"
        f"{clip_lines if clip_lines else '- none'}"
    )
