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

const PREBUFFER_SECONDS = 0.45;

function VerdictPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Record<string, TurnView>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [liveOnlyAudio, setLiveOnlyAudio] = useState(false);
  const activeSpeechUtteranceIdRef = useRef<string | null>(null);
  const analyzedSessionRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const queuedAudioEndTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingAudioChunksRef = useRef<Array<{ audioBase64: string; sampleRateHz: number }>>([]);
  const pendingAudioSecondsRef = useRef(0);
  const hasStartedPlaybackRef = useRef(false);
  const audioChunksByUtteranceRef = useRef<Record<string, number>>({});
  const browserTtsFallbackByUtteranceRef = useRef<Record<string, boolean>>({});
  const fallbackTimerByUtteranceRef = useRef<Record<string, number>>({});
  const { isConnected, messages, sendUserInterrupt } = useWebSocket(sessionId, Boolean(sessionId));

  function stopAudioPlayback() {
    for (const source of audioSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // no-op
      }
      source.disconnect();
    }
    audioSourcesRef.current = [];
    if (audioContextRef.current) {
      queuedAudioEndTimeRef.current = audioContextRef.current.currentTime;
    } else {
      queuedAudioEndTimeRef.current = 0;
    }
    pendingAudioChunksRef.current = [];
    pendingAudioSecondsRef.current = 0;
    hasStartedPlaybackRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function ensureAudioContext(sampleRateHz: number): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      return audioContextRef.current;
    }
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    audioContextRef.current = new AudioContextCtor({ sampleRate: sampleRateHz });
    queuedAudioEndTimeRef.current = audioContextRef.current.currentTime;
    return audioContextRef.current;
  }

  async function unlockAudio(): Promise<void> {
    const ctx = ensureAudioContext(24000);
    if (!ctx) {
      return;
    }
    try {
      await ctx.resume();
    } catch {
      // no-op
    }
  }

  function schedulePcmChunk(audioBase64: string, sampleRateHz: number) {
    if (!voiceEnabled || typeof window === "undefined") {
      return;
    }
    const ctx = ensureAudioContext(sampleRateHz);
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const binary = window.atob(audioBase64);
    const byteLength = binary.length;
    if (byteLength < 2) {
      return;
    }

    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i += 1) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, sampleRateHz);
    audioBuffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      audioSourcesRef.current = audioSourcesRef.current.filter((node) => node !== source);
      source.disconnect();
    };
    const startAt = Math.max(ctx.currentTime, queuedAudioEndTimeRef.current);
    source.start(startAt);
    queuedAudioEndTimeRef.current = startAt + audioBuffer.duration;
    audioSourcesRef.current.push(source);
  }

  function enqueueLiveAudioChunk(audioBase64: string, sampleRateHz: number) {
    const binaryLength = typeof window !== "undefined" ? window.atob(audioBase64).length : 0;
    const chunkDurationSec = binaryLength / (2 * sampleRateHz);
    pendingAudioChunksRef.current.push({ audioBase64, sampleRateHz });
    pendingAudioSecondsRef.current += chunkDurationSec;

    if (!hasStartedPlaybackRef.current) {
      if (pendingAudioSecondsRef.current < PREBUFFER_SECONDS) {
        return;
      }
      hasStartedPlaybackRef.current = true;
    }

    while (pendingAudioChunksRef.current.length > 0) {
      const next = pendingAudioChunksRef.current.shift();
      if (!next) {
        break;
      }
      schedulePcmChunk(next.audioBase64, next.sampleRateHz);
    }
    pendingAudioSecondsRef.current = 0;
  }

  function speakFallbackText(text: string) {
    if (!voiceEnabled || liveOnlyAudio || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    if (!text.trim()) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  function testVoice() {
    speakFallbackText("Crew chief audio is enabled.");
  }

  useEffect(() => {
    return () => {
      stopAudioPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const resolvedSessionId = sessionId;
    if (analyzedSessionRef.current === resolvedSessionId) {
      return;
    }
    analyzedSessionRef.current = resolvedSessionId;

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
      if (latest.type === "speech.start") {
        stopAudioPlayback();
        activeSpeechUtteranceIdRef.current = latest.payload.utteranceId;
        audioChunksByUtteranceRef.current[latest.payload.utteranceId] = 0;
        browserTtsFallbackByUtteranceRef.current[latest.payload.utteranceId] = false;
        fallbackTimerByUtteranceRef.current[latest.payload.utteranceId] = window.setTimeout(() => {
          const chunkCount = audioChunksByUtteranceRef.current[latest.payload.utteranceId] ?? 0;
          if (chunkCount === 0) {
            browserTtsFallbackByUtteranceRef.current[latest.payload.utteranceId] = true;
          }
        }, 4500);
      }

      if (
        browserTtsFallbackByUtteranceRef.current[latest.payload.utteranceId] &&
        activeSpeechUtteranceIdRef.current === latest.payload.utteranceId
      ) {
        speakFallbackText(latest.payload.text);
      }

      if (latest.type === "speech.end") {
        const timerId = fallbackTimerByUtteranceRef.current[latest.payload.utteranceId];
        if (timerId) {
          window.clearTimeout(timerId);
          delete fallbackTimerByUtteranceRef.current[latest.payload.utteranceId];
        }
        if (browserTtsFallbackByUtteranceRef.current[latest.payload.utteranceId]) {
          setTurns((prev) => {
            const existing = prev[latest.payload.turnId];
            const fallbackText = existing?.transcript?.trim() || latest.payload.text;
            speakFallbackText(fallbackText);
            return prev;
          });
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

    if (latest.type === "speech.audio.chunk") {
      if (activeSpeechUtteranceIdRef.current === latest.payload.utteranceId) {
        audioChunksByUtteranceRef.current[latest.payload.utteranceId] =
          (audioChunksByUtteranceRef.current[latest.payload.utteranceId] ?? 0) + 1;
        const timerId = fallbackTimerByUtteranceRef.current[latest.payload.utteranceId];
        if (timerId) {
          window.clearTimeout(timerId);
          delete fallbackTimerByUtteranceRef.current[latest.payload.utteranceId];
        }
        browserTtsFallbackByUtteranceRef.current[latest.payload.utteranceId] = false;
        enqueueLiveAudioChunk(latest.payload.audioBase64, latest.payload.sampleRateHz);
      }
      return;
    }

    if (latest.type === "user.interrupted") {
      stopAudioPlayback();
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
    if (!speakingTurn?.utteranceId) {
      return;
    }
    sendUserInterrupt({
      turnId: speakingTurn.turnId,
      utteranceId: speakingTurn.utteranceId,
      intent: "challenge",
      transcript: "User interrupted ongoing verdict explanation.",
    });
    stopAudioPlayback();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-court-950 via-court-900 to-court-950 text-white">
      <Header />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-8">
        <div className="flex items-center justify-between rounded-xl border border-court-700 bg-court-900/50 p-3">
          <p className="text-sm text-court-300">
            Session: {sessionId ?? "missing"} | WS: {isConnected ? "connected" : "offline"}
          </p>
          <div className="flex items-center gap-2">
            {speakingTurn ? (
              <button
                type="button"
                onClick={interruptActiveSpeech}
                className="rounded-md border border-whistle-500/60 px-3 py-1.5 text-sm text-whistle-300 hover:bg-whistle-500/10"
              >
                Interrupt
              </button>
            ) : null}
            <Link href="/" className="rounded-md border border-court-500 px-3 py-1.5 text-sm text-court-300 hover:bg-court-700/40">
              Back to Upload
            </Link>
          </div>
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
