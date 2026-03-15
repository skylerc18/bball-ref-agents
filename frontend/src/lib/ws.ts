import type { ReviewSession, Verdict, VerdictLevel } from "@/types/domain";
import { WS_URL } from "@/lib/constants";
import type { WsServerMessage } from "@/types/api";

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

  return {
    type: "analysis.done",
    payload: {
      sessionId: raw.payload.session_id,
      verdict: mapVerdict(raw),
    },
  };
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
