import { API_BASE_URL } from "@/lib/constants";
import type {
  AnalyzeSessionResponse,
  CreateSessionResponse,
  UploadAnglesRequest,
  UploadAnglesResponse,
} from "@/types/api";
import type { ReviewSession, Verdict } from "@/types/domain";

type BackendSession = {
  id: string;
  created_at: string;
  status: ReviewSession["status"];
};

type BackendEvidenceItem = {
  id: string;
  angle_id: string;
  timestamp_sec: number;
  confidence: number;
  reason: string;
};

type BackendVerdict = {
  level: Verdict["level"];
  confidence: number;
  summary: string;
  rule_reference: string;
  evidence: BackendEvidenceItem[];
};

type BackendAnalyzeResponse = {
  session_id: string;
  verdict: BackendVerdict;
};

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: string };
    return new Error(body.detail ?? `Request failed (${response.status})`);
  } catch {
    return new Error(`Request failed (${response.status})`);
  }
}

function mapSession(session: BackendSession): ReviewSession {
  return {
    id: session.id,
    createdAt: session.created_at,
    status: session.status,
  };
}

function mapVerdict(verdict: BackendVerdict): Verdict {
  return {
    level: verdict.level,
    confidence: verdict.confidence,
    summary: verdict.summary,
    ruleReference: verdict.rule_reference,
    evidence: verdict.evidence.map((item) => ({
      id: item.id,
      angleId: item.angle_id,
      timestampSec: item.timestamp_sec,
      confidence: item.confidence,
      reason: item.reason,
    })),
  };
}

export async function createReviewSession(): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as BackendSession;
  return {
    session: mapSession(payload),
  };
}

export async function uploadAngles(payload: UploadAnglesRequest): Promise<UploadAnglesResponse> {
  const formData = new FormData();
  payload.angles.forEach((angle) => {
    formData.append("files", angle.file, angle.fileName);
  });

  const response = await fetch(`${API_BASE_URL}/api/sessions/${payload.sessionId}/angles`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as { accepted: boolean; uploaded_count: number; uploadedCount?: number };

  return {
    accepted: body.accepted,
    uploadedCount: body.uploadedCount ?? body.uploaded_count,
  };
}

export async function analyzeSession(sessionId: string): Promise<AnalyzeSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/analyze`, {
    method: "POST",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as BackendAnalyzeResponse;

  return {
    sessionId: payload.session_id,
    verdict: mapVerdict(payload.verdict),
  };
}
