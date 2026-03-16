import type { VerdictLevel } from "@/types/domain";

export type AgentName =
  | "session_orchestrator"
  | "crew_chief"
  | "contact_detection"
  | "ball_tracking"
  | "timing";

export type TurnState = "collecting" | "deliberating" | "committed" | "speaking" | "interrupted" | "done";

export type FindingType = "contact" | "ball_position" | "clock_event" | "rule_context";

export type EvidenceRef = {
  angleId: string;
  timestampSec: number;
  clipStartSec?: number;
  clipEndSec?: number;
};

export type FindingPayload = {
  sessionId: string;
  turnId: string;
  findingId: string;
  sourceAgent: AgentName;
  findingType: FindingType;
  value: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  version: number;
};

export type TurnStatusPayload = {
  sessionId: string;
  turnId: string;
  state: TurnState;
  reason?: string;
};

export type VerdictClaim = {
  level: VerdictLevel;
  summary: string;
  ruleReference: string;
  confidence: number;
};

export type CommittedVerdictPayload = {
  sessionId: string;
  turnId: string;
  verdictId: string;
  claim: VerdictClaim;
  rationalePoints: string[];
  evidenceRefs: EvidenceRef[];
  voiceBrief?: string;
  committedAt: string;
};

export type SpeechChunkPayload = {
  sessionId: string;
  turnId: string;
  verdictId: string;
  utteranceId: string;
  chunkIndex: number;
  text: string;
  isFinalChunk: boolean;
};

export type SpeechAudioChunkPayload = {
  sessionId: string;
  turnId: string;
  verdictId: string;
  utteranceId: string;
  chunkIndex: number;
  audioBase64: string;
  mimeType: string;
  sampleRateHz: number;
};

export type UserInterruptionPayload = {
  sessionId: string;
  turnId: string;
  utteranceId: string;
  interruptionId: string;
  intent: "challenge" | "clarify" | "counterfactual" | "new_angle" | "other";
  transcript: string;
  interruptedAt: string;
};

export type RealtimeServerMessage =
  | { type: "finding.delta"; payload: FindingPayload }
  | { type: "finding.final"; payload: FindingPayload }
  | { type: "turn.status"; payload: TurnStatusPayload }
  | { type: "verdict.committed"; payload: CommittedVerdictPayload }
  | { type: "speech.start"; payload: SpeechChunkPayload }
  | { type: "speech.chunk"; payload: SpeechChunkPayload }
  | { type: "speech.end"; payload: SpeechChunkPayload }
  | { type: "speech.audio.chunk"; payload: SpeechAudioChunkPayload }
  | { type: "user.interrupted"; payload: UserInterruptionPayload };
