import { API_BASE_URL } from "@/lib/constants";
import type {
  AnalyzeSessionResponse,
  CreateSessionResponse,
  ExampleSummary,
  ListExamplesResponse,
  UploadAnglesRequest,
  UploadAnglesResponse,
} from "@/types/api";
import type { ReviewSession, Verdict } from "@/types/domain";

type BackendSession = {
  id: string;
  created_at: string;
  status: ReviewSession["status"];
};

type BackendExampleClip = {
  id: string;
  label: string;
  src_url: string;
};

type BackendExampleSummary = {
  example_id: string;
  title: string;
  description?: string | null;
  tags?: string[];
  clip_count: number;
  clips?: BackendExampleClip[];
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

function mapExample(example: BackendExampleSummary): ExampleSummary {
  return {
    exampleId: example.example_id,
    title: example.title,
    description: example.description ?? null,
    tags: example.tags ?? [],
    clipCount: example.clip_count,
    clips: (example.clips ?? []).map((clip) => ({
      id: clip.id,
      label: clip.label,
      srcUrl: clip.src_url.startsWith("http") ? clip.src_url : `${API_BASE_URL}${clip.src_url}`,
    })),
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
    if (angle.file) {
      formData.append("files", angle.file, angle.fileName);
    }
  });
  if (!formData.has("files")) {
    throw new Error("No uploadable files found for this session.");
  }

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

export async function listExamples(): Promise<ListExamplesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/examples`, { method: "GET" });
  if (!response.ok) {
    throw await parseError(response);
  }
  const payload = (await response.json()) as { examples: BackendExampleSummary[] };
  return {
    examples: (payload.examples ?? []).map(mapExample),
  };
}

export async function createSessionFromExample(exampleId: string): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/from-example/${encodeURIComponent(exampleId)}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const payload = (await response.json()) as BackendSession;
  return { session: mapSession(payload) };
}
