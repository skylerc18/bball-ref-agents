"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/common/Header";
import { VerdictCard } from "@/components/verdict/VerdictCard";
import { EvidenceTimeline } from "@/components/verdict/EvidenceTimeline";
import { useWebSocket } from "@/hooks/useWebSocket";
import { analyzeSession } from "@/lib/api";
import type { Verdict } from "@/types/domain";

export default function VerdictPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, messages } = useWebSocket(sessionId, Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const resolvedSessionId = sessionId;

    let cancelled = false;

    async function loadVerdict() {
      setIsProcessing(true);
      setError(null);

      try {
        const res = await analyzeSession(resolvedSessionId);
        if (!cancelled) {
          setVerdict(res.verdict);
        }
      } catch {
        if (!cancelled) {
          setError("Could not generate verdict. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    }

    void loadVerdict();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest) {
      return;
    }

    if (latest.type === "analysis.done") {
      setVerdict(latest.payload.verdict);
      setIsProcessing(false);
    }
  }, [messages]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-court-950 via-court-900 to-court-950 text-white">
      <Header />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-8">
        <div className="flex items-center justify-between rounded-xl border border-court-700 bg-court-900/50 p-3">
          <p className="text-sm text-court-300">
            Session: {sessionId ?? "missing"} | WS: {isConnected ? "connected" : "offline"}
          </p>
          <Link href="/" className="rounded-md border border-court-500 px-3 py-1.5 text-sm text-court-300 hover:bg-court-700/40">
            Back to Upload
          </Link>
        </div>

        {!sessionId ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
            Missing session id. Return to upload screen and generate verdict again.
          </p>
        ) : null}

        {error ? <p className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">{error}</p> : null}

        <VerdictCard verdict={verdict} isProcessing={isProcessing} />
        <EvidenceTimeline evidence={verdict?.evidence ?? []} />
      </div>
    </main>
  );
}
