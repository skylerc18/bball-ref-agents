"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/common/Header";
import { VerdictCard } from "@/components/verdict/VerdictCard";
import { EvidenceTimeline } from "@/components/verdict/EvidenceTimeline";
import { useWebSocket } from "@/hooks/useWebSocket";
import { analyzeSession } from "@/lib/api";
import type { Verdict } from "@/types/domain";
import type { TurnState } from "@/types/realtime";

type TurnView = {
  turnId: string;
  state: TurnState;
  transcript: string;
  utteranceId?: string;
  interrupted: boolean;
  interruptionIntent?: "challenge" | "clarify" | "counterfactual" | "new_angle" | "other";
  verdictSummary?: string;
};

function VerdictPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Record<string, TurnView>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const activeSpeechUtteranceIdRef = useRef<string | null>(null);
  const { isConnected, messages, sendUserInterrupt } = useWebSocket(sessionId, Boolean(sessionId));

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      return;
    }

    if (latest.type === "verdict.committed") {
      setVerdict({
        level: latest.payload.claim.level,
        confidence: latest.payload.claim.confidence,
        summary: latest.payload.claim.summary,
        ruleReference: latest.payload.claim.ruleReference,
        evidence: latest.payload.evidenceRefs.map((item, index) => ({
          id: `${latest.payload.verdictId}_e_${index}`,
          angleId: item.angleId,
          timestampSec: item.timestampSec,
          confidence: latest.payload.claim.confidence,
          reason: latest.payload.claim.summary,
        })),
      });
      setIsProcessing(false);
      setTurns((prev) => ({
        ...prev,
        [latest.payload.turnId]: {
          turnId: latest.payload.turnId,
          state: prev[latest.payload.turnId]?.state ?? "committed",
          transcript: prev[latest.payload.turnId]?.transcript ?? "",
          utteranceId: prev[latest.payload.turnId]?.utteranceId,
          interrupted: prev[latest.payload.turnId]?.interrupted ?? false,
          interruptionIntent: prev[latest.payload.turnId]?.interruptionIntent,
          verdictSummary: latest.payload.claim.summary,
        },
      }));
      return;
    }

    if (latest.type === "turn.status") {
      setTurns((prev) => ({
        ...prev,
        [latest.payload.turnId]: {
          turnId: latest.payload.turnId,
          state: latest.payload.state,
          transcript: prev[latest.payload.turnId]?.transcript ?? "",
          utteranceId: prev[latest.payload.turnId]?.utteranceId,
          interrupted: prev[latest.payload.turnId]?.interrupted ?? false,
          interruptionIntent: prev[latest.payload.turnId]?.interruptionIntent,
          verdictSummary: prev[latest.payload.turnId]?.verdictSummary,
        },
      }));
      return;
    }

    if (latest.type === "speech.start" || latest.type === "speech.chunk" || latest.type === "speech.end") {
      if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        if (latest.type === "speech.start") {
          window.speechSynthesis.cancel();
          activeSpeechUtteranceIdRef.current = latest.payload.utteranceId;
        }
        if (activeSpeechUtteranceIdRef.current === latest.payload.utteranceId && latest.payload.text.trim()) {
          const utterance = new SpeechSynthesisUtterance(latest.payload.text);
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.volume = 1;
          window.speechSynthesis.speak(utterance);
        }
      }

      setTurns((prev) => {
        const existing = prev[latest.payload.turnId];
        const nextTranscript = [existing?.transcript ?? "", latest.payload.text].join(" ").trim();
        return {
          ...prev,
          [latest.payload.turnId]: {
            turnId: latest.payload.turnId,
            state: existing?.state ?? "speaking",
            transcript: nextTranscript,
            utteranceId: latest.payload.utteranceId,
            interrupted: existing?.interrupted ?? false,
            interruptionIntent: existing?.interruptionIntent,
            verdictSummary: existing?.verdictSummary,
          },
        };
      });
      return;
    }

    if (latest.type === "user.interrupted") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setTurns((prev) => ({
        ...prev,
        [latest.payload.turnId]: {
          turnId: latest.payload.turnId,
          state: "interrupted",
          transcript: prev[latest.payload.turnId]?.transcript ?? "",
          utteranceId: latest.payload.utteranceId,
          interrupted: true,
          interruptionIntent: latest.payload.intent,
          verdictSummary: prev[latest.payload.turnId]?.verdictSummary,
        },
      }));
    }
  }, [messages]);

  const orderedTurns = Object.values(turns).sort((a, b) => a.turnId.localeCompare(b.turnId));
  const speakingTurn = [...orderedTurns].reverse().find((turn) => turn.state === "speaking" && turn.utteranceId);

  function interruptActiveSpeech() {
    if (!speakingTurn || !speakingTurn.utteranceId) {
      return;
    }
    sendUserInterrupt({
      turnId: speakingTurn.turnId,
      utteranceId: speakingTurn.utteranceId,
      intent: "challenge",
      transcript: "User interrupted the current explanation.",
    });
  }

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
        <section className="rounded-2xl border border-court-700 bg-court-900/60 p-4 shadow-panel">
          <h2 className="text-lg font-semibold text-white">Live Controls</h2>
          <p className="mt-2 text-sm text-court-300">Interrupts are user-driven and only apply to the current speaking turn.</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-court-500 px-3 py-1.5 text-sm text-court-200 hover:bg-court-700/40"
            onClick={() => setVoiceEnabled((prev) => !prev)}
          >
            Voice: {voiceEnabled ? "on" : "off"}
          </button>
          <button
            type="button"
            className="mt-3 ml-2 rounded-md border border-court-500 px-3 py-1.5 text-sm text-court-200 enabled:hover:bg-court-700/40 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={interruptActiveSpeech}
            disabled={!speakingTurn}
          >
            Interrupt Active Speech
          </button>
        </section>
        <section className="rounded-2xl border border-court-700 bg-court-900/60 p-4 shadow-panel">
          <h2 className="text-lg font-semibold text-white">Turn Transcript</h2>
          {orderedTurns.length === 0 ? (
            <p className="mt-3 text-sm text-court-300">No turn events yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {orderedTurns.map((turn) => (
                <article key={turn.turnId} className="rounded-lg border border-court-700 bg-court-950/40 p-3">
                  <p className="text-sm text-court-200">
                    {turn.turnId} | state: {turn.state}
                    {turn.interrupted ? ` | interrupted (${turn.interruptionIntent ?? "other"})` : ""}
                  </p>
                  {turn.verdictSummary ? <p className="mt-1 text-sm text-court-300">Committed: {turn.verdictSummary}</p> : null}
                  <p className="mt-2 text-sm text-court-100">{turn.transcript || "No speech chunks received yet."}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function VerdictPageFallback() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-court-950 via-court-900 to-court-950 text-white">
      <Header />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <p className="rounded-md border border-court-700 bg-court-900/50 p-3 text-sm text-court-300">Loading verdict...</p>
      </div>
    </main>
  );
}

export default function VerdictPage() {
  return (
    <Suspense fallback={<VerdictPageFallback />}>
      <VerdictPageContent />
    </Suspense>
  );
}
