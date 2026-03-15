import type { ReviewSession, Verdict, VerdictLevel } from "@/types/domain";
import { WS_URL } from "@/lib/constants";
import type { WsServerMessage } from "@/types/api";
import type { AgentName, FindingType, TurnState } from "@/types/realtime";

type RawWsMessage =
  | { type: "session.status"; payload: { session_id: string; status: ReviewSession["status"] } }
  | { type: "analysis.progress"; payload: { session_id: string; progress: number } }
  | {
      type: "analysis.done";
      payload: {
        session_id: string;
        verdict: {
          level: VerdictLevel;
          confidence: number;
          summary: string;
          rule_reference: string;
          evidence: Array<{
            id: string;
            angle_id: string;
            timestamp_sec: number;
            confidence: number;
            reason: string;
          }>;
        };
      };
    }
  | {
      type: "finding.delta" | "finding.final";
      payload: {
        session_id: string;
        turn_id: string;
        finding_id: string;
        source_agent: AgentName;
        finding_type: FindingType;
        value: string;
        confidence: number;
        evidence_refs: Array<{
          angle_id: string;
          timestamp_sec: number;
          clip_start_sec?: number;
          clip_end_sec?: number;
        }>;
        version: number;
      };
    }
  | {
      type: "turn.status";
      payload: {
        session_id: string;
        turn_id: string;
        state: TurnState;
        reason?: string;
      };
    }
  | {
      type: "verdict.committed";
      payload: {
        session_id: string;
        turn_id: string;
        verdict_id: string;
        claim: {
          level: VerdictLevel;
          summary: string;
          rule_reference: string;
          confidence: number;
        };
        rationale_points: string[];
        evidence_refs: Array<{
          angle_id: string;
          timestamp_sec: number;
          clip_start_sec?: number;
          clip_end_sec?: number;
        }>;
        committed_at: string;
      };
    }
  | {
      type: "speech.start" | "speech.chunk" | "speech.end";
      payload: {
        session_id: string;
        turn_id: string;
        verdict_id: string;
        utterance_id: string;
        chunk_index: number;
        text: string;
        is_final_chunk: boolean;
      };
    }
  | {
      type: "user.interrupted";
      payload: {
        session_id: string;
        turn_id: string;
        utterance_id: string;
        interruption_id: string;
        intent: "challenge" | "clarify" | "counterfactual" | "new_angle" | "other";
        transcript: string;
        interrupted_at: string;
      };
    };

function mapVerdict(raw: RawWsMessage & { type: "analysis.done" }): Verdict {
  return {
    level: raw.payload.verdict.level,
    confidence: raw.payload.verdict.confidence,
    summary: raw.payload.verdict.summary,
    ruleReference: raw.payload.verdict.rule_reference,
    evidence: raw.payload.verdict.evidence.map((item) => ({
      id: item.id,
      angleId: item.angle_id,
      timestampSec: item.timestamp_sec,
      confidence: item.confidence,
      reason: item.reason,
    })),
  };
}

function mapEvidenceRef(item: {
  angle_id: string;
  timestamp_sec: number;
  clip_start_sec?: number;
  clip_end_sec?: number;
}) {
  return {
    angleId: item.angle_id,
    timestampSec: item.timestamp_sec,
    clipStartSec: item.clip_start_sec,
    clipEndSec: item.clip_end_sec,
  };
}

function normalizeWsMessage(raw: RawWsMessage): WsServerMessage {
  if (raw.type === "session.status") {
    return {
      type: "session.status",
      payload: {
        sessionId: raw.payload.session_id,
        status: raw.payload.status,
      },
    };
  }

  if (raw.type === "analysis.progress") {
    return {
      type: "analysis.progress",
      payload: {
        sessionId: raw.payload.session_id,
        progress: raw.payload.progress,
      },
    };
  }

  if (raw.type === "analysis.done") {
    return {
      type: "analysis.done",
      payload: {
        sessionId: raw.payload.session_id,
        verdict: mapVerdict(raw),
      },
    };
  }

  if (raw.type === "finding.delta" || raw.type === "finding.final") {
    return {
      type: raw.type,
      payload: {
        sessionId: raw.payload.session_id,
        turnId: raw.payload.turn_id,
        findingId: raw.payload.finding_id,
        sourceAgent: raw.payload.source_agent,
        findingType: raw.payload.finding_type,
        value: raw.payload.value,
        confidence: raw.payload.confidence,
        evidenceRefs: raw.payload.evidence_refs.map(mapEvidenceRef),
        version: raw.payload.version,
      },
    };
  }

  if (raw.type === "turn.status") {
    return {
      type: "turn.status",
      payload: {
        sessionId: raw.payload.session_id,
        turnId: raw.payload.turn_id,
        state: raw.payload.state,
        reason: raw.payload.reason,
      },
    };
  }

  if (raw.type === "verdict.committed") {
    return {
      type: "verdict.committed",
      payload: {
        sessionId: raw.payload.session_id,
        turnId: raw.payload.turn_id,
        verdictId: raw.payload.verdict_id,
        claim: {
          level: raw.payload.claim.level,
          summary: raw.payload.claim.summary,
          ruleReference: raw.payload.claim.rule_reference,
          confidence: raw.payload.claim.confidence,
        },
        rationalePoints: raw.payload.rationale_points,
        evidenceRefs: raw.payload.evidence_refs.map(mapEvidenceRef),
        committedAt: raw.payload.committed_at,
      },
    };
  }

  if (raw.type === "speech.start" || raw.type === "speech.chunk" || raw.type === "speech.end") {
    return {
      type: raw.type,
      payload: {
        sessionId: raw.payload.session_id,
        turnId: raw.payload.turn_id,
        verdictId: raw.payload.verdict_id,
        utteranceId: raw.payload.utterance_id,
        chunkIndex: raw.payload.chunk_index,
        text: raw.payload.text,
        isFinalChunk: raw.payload.is_final_chunk,
      },
    };
  }

  if (raw.type === "user.interrupted") {
    return {
      type: "user.interrupted",
      payload: {
        sessionId: raw.payload.session_id,
        turnId: raw.payload.turn_id,
        utteranceId: raw.payload.utterance_id,
        interruptionId: raw.payload.interruption_id,
        intent: raw.payload.intent,
        transcript: raw.payload.transcript,
        interruptedAt: raw.payload.interrupted_at,
      },
    };
  }

  throw new Error(`Unsupported WS message type: ${(raw as { type?: string }).type ?? "unknown"}`);
}

export function createWsConnection(
  sessionId: string,
  onMessage: (message: WsServerMessage) => void,
  onError?: (error: Event) => void,
): WebSocket {
  const ws = new WebSocket(`${WS_URL}/sessions/${encodeURIComponent(sessionId)}`);

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as RawWsMessage;
      onMessage(normalizeWsMessage(parsed));
    } catch {
      // Ignore malformed messages during early MVP integration.
    }
  };

  if (onError) {
    ws.onerror = onError;
  }

  return ws;
}
