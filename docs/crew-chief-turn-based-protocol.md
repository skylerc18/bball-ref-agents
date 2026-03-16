# Crew Chief Turn-Based Realtime Protocol

## Goal
The Crew Chief must only speak after a verdict is committed.  
It must not revise itself mid-sentence based on subagent updates.  
Only user interruptions can stop speech and trigger a new response turn.

## Core Rule
- Commit before speak.
- Each spoken response is bound to a single immutable `verdict_id`.
- Late subagent findings are queued for the next turn, not injected into the current utterance.

## Turn State Machine
- `collecting`: specialist agents emit findings.
- `deliberating`: crew chief resolves conflicts and decides if evidence is sufficient.
- `committed`: verdict is fixed and published.
- `speaking`: crew chief emits speech chunks for the committed verdict.
- `interrupted`: user interruption cut current speech.
- `done`: turn is complete.

Valid transitions:
- `collecting -> deliberating`
- `deliberating -> committed`
- `committed -> speaking`
- `speaking -> done`
- `speaking -> interrupted`
- `interrupted -> deliberating` (new turn)

## Realtime Events

Server outbound:
- `finding.delta`: non-final specialist update.
- `finding.final`: specialist final update for current turn.
- `turn.status`: authoritative turn state transitions.
- `verdict.committed`: immutable verdict payload for this turn.
- `speech.start`: first chunk metadata for current utterance.
- `speech.chunk`: incremental spoken text chunks.
- `speech.end`: utterance end marker.
- `user.interrupted`: acknowledgement that the active utterance was interrupted.

Client inbound:
- `user.interrupt`: stop current speech and provide transcript + intent classification input.
- `user.query`: optional follow-up query tied to last committed verdict.

## Commit Gate
Crew Chief can emit `verdict.committed` only when all pass:
- Required specialist agents returned `finding.final` or timeout fired.
- No unresolved hard contradiction remains.
- Confidence threshold reached.

Suggested defaults:
- Required agents: `contact_detection`, `ball_tracking`, `timing`.
- Soft timeout: 1200 ms per agent.
- Minimum confidence: 0.72.

## Immutability Contract
- `verdict_id` is immutable once emitted.
- During `speaking`, the backend ignores new specialist findings for active utterance logic.
- New findings are appended to session memory and evaluated when a new turn starts.

## Interruption Contract
- User interruption is the only legal speech stop trigger.
- On interruption, emit `user.interrupted`.
- On interruption, stop the active TTS stream.
- On interruption, transition turn to `interrupted`.
- On interruption, start a fresh deliberation cycle for the next turn.

Recommended interruption intents:
- `challenge`: user disputes the committed call.
- `clarify`: user asks for explanation.
- `counterfactual`: user asks "what if" style change.
- `new_angle`: user introduces perspective from another angle/time.

## Payload IDs
- `session_id`: overall review session.
- `turn_id`: monotonically increasing within session (`turn_0001`, `turn_0002`, ...).
- `verdict_id`: immutable committed verdict id (`v_...`).
- `utterance_id`: one speech stream tied to a verdict.
- `finding_id`: unique per specialist finding.

## Frontend Handling
- Render committed verdict immediately on `verdict.committed`.
- Treat speech events as presentation only, not source of truth.
- Display per-turn transcript under `turn_id`.
- If interrupted, mark turn as interrupted and preserve partial transcript.

## Backend Handling
- Session orchestrator owns turn lifecycle and timeout policy.
- Crew chief subscribes to specialist findings, computes commitment, then emits speech.
- TTS worker streams `speech.start/chunk/end` for a fixed `verdict_id`.

## Minimal Adoption Plan
1. Add new schema layer in backend and frontend types.
2. Publish `turn.status` + `verdict.committed` while keeping existing `analysis.done` for compatibility.
3. Add speech events and wire transcript UI.
4. Add `user.interrupt` pathway and barge-in support.
5. Remove legacy `analysis.done` after clients migrate.
