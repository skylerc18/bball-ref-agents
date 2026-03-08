import type { CameraAngle, ReviewSession, Verdict } from "@/types/domain";

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

export type WsServerMessage =
  | { type: "session.status"; payload: { sessionId: string; status: ReviewSession["status"] } }
  | { type: "analysis.progress"; payload: { sessionId: string; progress: number } }
  | { type: "analysis.done"; payload: AnalyzeSessionResponse };
