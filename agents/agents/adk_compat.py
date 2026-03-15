from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

try:
    from google.adk.agents import Agent  # type: ignore
except Exception:  # pragma: no cover - local fallback only
    @dataclass
    class Agent:  # type: ignore[override]
        name: str
        model: str
        instruction: str
        description: str = ""
        tools: list[Callable[..., Any]] = field(default_factory=list)
        sub_agents: list["Agent"] = field(default_factory=list)
        output_key: str | None = None
