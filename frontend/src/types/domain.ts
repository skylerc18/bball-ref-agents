export type CameraAngle = {
  id: string;
  label: string;
  file?: File;
  fileName: string;
  fileSize: number;
  durationSec?: number;
  srcUrl: string;
};

export type ReviewSession = {
  id: string;
  createdAt: string;
  status: "idle" | "uploading" | "processing" | "complete" | "error";
};

export type VerdictLevel = "upheld" | "overruled" | "inconclusive";

export type EvidenceItem = {
  id: string;
  angleId: string;
  timestampSec: number;
  confidence: number;
  reason: string;
};

export type Verdict = {
  level: VerdictLevel;
  confidence: number;
  summary: string;
  ruleReference: string;
  evidence: EvidenceItem[];
};

export type SyncState = {
  currentTimeSec: number;
  durationSec: number;
  isPlaying: boolean;
  playbackRate: number;
};
