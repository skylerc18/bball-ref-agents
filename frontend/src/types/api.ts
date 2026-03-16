import type { CameraAngle, ReviewSession, Verdict } from "@/types/domain";
import type { RealtimeServerMessage } from "@/types/realtime";

export type CreateSessionResponse = {
  session: ReviewSession;
};

export type UploadAnglesRequest = {
  sessionId: string;
  angles: CameraAngle[];
};

export type UploadAnglesResponse = {
  accepted: boolean;
  uploadedCount: number;
};

export type AnalyzeSessionResponse = {
  sessionId: string;
  verdict: Verdict;
};

export type ExampleClip = {
  id: string;
  label: string;
  srcUrl: string;
};

export type ExampleSummary = {
  exampleId: string;
  title: string;
  description: string | null;
  tags: string[];
  clipCount: number;
  clips: ExampleClip[];
};

export type ListExamplesResponse = {
  examples: ExampleSummary[];
};

export type WsServerMessage =
  | { type: "session.status"; payload: { sessionId: string; status: ReviewSession["status"] } }
  | { type: "analysis.progress"; payload: { sessionId: string; progress: number } }
  | { type: "analysis.done"; payload: AnalyzeSessionResponse }
  | RealtimeServerMessage;
