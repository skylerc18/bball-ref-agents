from workflows.session_workflow import build_agent_tree
from workflows.session_workflow import build_session_prompt
from schemas.session import PlayerContext, SessionInput, SessionMetadata


def test_agent_tree_has_required_agents() -> None:
    root = build_agent_tree()
    names = {agent.name for agent in root.sub_agents}

    assert root.name == "session_orchestrator_agent"
    assert "contact_detection_agent" in names
    assert "ball_tracking_agent" in names
    assert "timing_agent" in names
    assert "angle_analyst_agent" in names
    assert "boundary_agent" in names
    assert "crew_chief_agent" in names


def test_session_prompt_includes_metadata() -> None:
    session = SessionInput(
        session_id="session_123",
        metadata=SessionMetadata(
            players_on_court=[
                PlayerContext(player_id="p1", display_name="Alex Guard", team="Home", jersey_number="3"),
            ],
            players_involved_in_play=["p1", "p9"],
            game_clock="02:11",
            shot_clock="07",
            period="Q4",
            possession_team="Home",
        ),
    )

    prompt = build_session_prompt(session)
    assert "game clock: 02:11" in prompt
    assert "players involved in play: p1, p9" in prompt
    assert "Alex Guard (p1)" in prompt
