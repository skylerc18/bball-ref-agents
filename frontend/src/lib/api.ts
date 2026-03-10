import type {
  AnalyzeSessionResponse,
  CreateSessionResponse,
  UploadAnglesRequest,
  UploadAnglesResponse,
} from "@/types/api";
import type { Verdict } from "@/types/domain";

function fakeDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createReviewSession(): Promise<CreateSessionResponse> {
  // await fakeDelay(200);

  return {
    session: {
      id: `session_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "idle",
    },
  };
}

export async function uploadAngles(payload: UploadAnglesRequest): Promise<UploadAnglesResponse> {
  void payload;
  await fakeDelay(500);

  return {
    accepted: true,
    uploadedCount: payload.angles.length,
  };
}

function buildMockVerdict(sessionId: string): AnalyzeSessionResponse {
  const verdict: Verdict = {
    level: "upheld",
    confidence: 0.84,
    summary: "Defender established legal guarding position before contact; offensive player initiated displacement.",
    ruleReference: "NFHS Rule 4-23",
    evidence: [
      {
        id: `${sessionId}_ev_1`,
        angleId: "angle-1",
        timestampSec: 3.2,
        confidence: 0.87,
        reason: "Lead foot set outside restricted space before torso collision.",
      },
      {
        id: `${sessionId}_ev_2`,
        angleId: "angle-2",
        timestampSec: 3.4,
        confidence: 0.81,
        reason: "Secondary angle confirms no downward arm contact from defender.",
      },
    ],
  };

  return { sessionId, verdict };
}

export async function analyzeSession(sessionId: string): Promise<AnalyzeSessionResponse> {
  await fakeDelay(1000);
  return buildMockVerdict(sessionId);
}
