# Basketball AI Ref - Architecture Diagram

## 1) System Architecture (High Level)

```mermaid
flowchart LR
    U[User Browser]

    subgraph FE[Frontend - Next.js 15 / React / TypeScript]
        FE1[Upload + Example Selection UI]
        FE2[Verdict UI + Audio Playback]
        FE3[WebSocket Client<br/>useWebSocket + ws.ts]
        FE4[REST Client<br/>lib/api.ts]
    end

    subgraph BE[Backend - FastAPI / Python]
        B1["POST /api/sessions"]
        B2["POST /api/sessions/:session_id/angles"]
        B3["POST /api/sessions/from-example/:example_id"]
        B4["POST /api/sessions/:session_id/analyze"]
        B5["GET /api/sessions/examples"]
        B6["WS /ws/sessions/:session_id"]

        B7[ReviewOrchestrator]
        B8[AgentsClient]
        B9[SpeechStreamManager]
        B10[ConnectionManager]
        B11[(SQLite SessionRepository)]
        B12[ExampleService]
        B13[(media/examples/*.mp4)]
        B14[(Session Metadata Fixtures JSON)]
    end

    subgraph AG[Agent Layer - Google ADK + Gemini]
        A0[Session Orchestrator Agent]
        A1[contact_detection_agent]
        A2[ball_tracking_agent]
        A3[timing_agent]
        A4[angle_analyst_agent]
        A5[boundary_agent]
        A6[crew_chief_agent<br/>FinalDecision JSON]
        A7[(NBA Rules JSON + Comments JSON)]
    end

    subgraph GENAI[Gemini APIs]
        G1[Gemini Models<br/>2.5 Flash / 2.5 Pro]
        G2[Gemini Live API<br/>Streaming Audio TTS]
    end

    subgraph GCP[Google Cloud]
        C1[Cloud Run - Frontend Service]
        C2[Cloud Run - Backend Service]
        C3[Cloud Build Pipelines]
        C4[Secret Manager / Env]
    end

    U --> FE1
    U --> FE2
    FE4 --> B1
    FE4 --> B2
    FE4 --> B3
    FE4 --> B4
    FE4 --> B5
    FE3 <--> B6

    B3 --> B12
    B12 --> B13
    B12 --> B14
    B12 --> B11

    B4 --> B7
    B7 --> B8
    B7 --> B9
    B7 --> B10
    B7 --> B11

    B8 --> A0
    A0 --> A1
    A0 --> A2
    A0 --> A3
    A0 --> A4
    A0 --> A5
    A0 --> A6
    A6 --> A7
    A0 --> G1
    A6 --> G1

    B9 --> G2
    G2 --> B6
    B6 --> FE2

    C1 --> FE
    C2 --> BE
    C3 --> C1
    C3 --> C2
    C4 --> C2
```

## 2) Clip Analysis + Verdict Sequence

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant Repo as SessionRepository (SQLite)
    participant Orch as ReviewOrchestrator
    participant AC as AgentsClient
    participant ADK as ADK Agent Tree
    participant Live as Gemini Live API

    User->>FE: Select built-in example or upload clips
    alt Built-in Example
        FE->>BE: POST /api/sessions/from-example/{example_id}
        BE->>Repo: Save angles + context_metadata
    else File Upload
        FE->>BE: POST /api/sessions
        FE->>BE: POST /api/sessions/{id}/angles
        BE->>Repo: Save uploaded angle metadata
    end

    FE->>BE: WS connect /ws/sessions/{session_id}
    FE->>BE: POST /api/sessions/{session_id}/analyze
    BE->>Orch: analyze(session_id)
    Orch->>Repo: status=processing, turn lifecycle
    Orch-->>FE: turn.status + analysis.progress (WS)

    Orch->>AC: analyze(angles, metadata_override)
    AC->>ADK: run session orchestrator + specialists + crew chief
    ADK->>ADK: Combine clip evidence + game metadata + NBA rules
    ADK-->>AC: FinalDecision JSON
    AC-->>Orch: normalized Verdict

    Orch->>Repo: Persist verdict + session complete
    Orch-->>FE: verdict.committed + analysis.done (WS)
    Orch-->>FE: speech.start/chunk/end (WS text)
    Orch->>Live: Gemini Live audio synthesis
    Live-->>Orch: audio chunks
    Orch-->>FE: speech.audio.chunk (WS audio)

    User->>FE: Interrupt during speaking
    FE->>BE: user.interrupt (WS)
    BE->>Orch: handle_user_interrupt(...)
    Orch->>Repo: mark turn interrupted + create next turn
    Orch-->>FE: user.interrupted + new turn.status
```

## 3) Key Grounding Inputs For Crew Chief

- Per-session game metadata (`context_metadata`) from fixture JSON or uploaded session context.
- Players on court + involved players (team, jersey, role in play).
- Call context (`call_type`, `ruling_on_floor`, whistle time, trigger).
- NBA rules corpus (`agents/prompts/nba_rules.json`) + comments (`nba_rules_comments.json`).
- Multi-angle clip evidence (timestamps, possession/contact/boundary/timing signals from specialists).
