"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/common/Header";
import { MultiAngleUploader } from "@/components/upload/MultiAngleUploader";
import { SyncVideoGrid } from "@/components/review/SyncVideoGrid";
import { PlaybackControls } from "@/components/review/PlaybackControls";
import { VerdictCard } from "@/components/verdict/VerdictCard";
import { EvidenceTimeline } from "@/components/verdict/EvidenceTimeline";
import { useClipUpload } from "@/hooks/useClipUpload";
import { useSession } from "@/hooks/useSession";
import { useSyncedPlayback } from "@/hooks/useSyncedPlayback";
import { useWebSocket } from "@/hooks/useWebSocket";
import { analyzeSession, uploadAngles } from "@/lib/api";
import type { Verdict } from "@/types/domain";

export default function Page() {
  const { angles, setFromFiles, clear } = useClipUpload();
  const { session, ensureSession, setSession } = useSession();
  const { isConnected } = useWebSocket(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const angleIds = useMemo(() => angles.map((angle) => angle.id), [angles]);

  const { syncState, register, play, pause, seek, setRate, toggleMuteAll, hasVideos } =
    useSyncedPlayback(angleIds);

  const onClearAll = () => {
    clear();
    setVerdict(null);
    setError(null);
    if (session) {
      setSession({ ...session, status: "idle" });
    }
  };

  const runAnalysis = async () => {
    setError(null);

    if (angles.length === 0) {
      setError("Upload at least one video angle before analysis.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const activeSession = await ensureSession();
      setSession({ ...activeSession, status: "uploading" });

      await uploadAngles({ sessionId: activeSession.id, angles });
      setSession({ ...activeSession, status: "processing" });

      const res = await analyzeSession(activeSession.id);
      setVerdict(res.verdict);
      setSession({ ...activeSession, status: "complete" });
    } catch {
      setError("Analysis failed. Please retry.");
      if (session) {
        setSession({ ...session, status: "error" });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-court-950 via-court-900 to-court-950 text-white">
      <Header />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 xl:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          <MultiAngleUploader angles={angles} onFilesSelected={setFromFiles} onClear={onClearAll} />

          <PlaybackControls
            state={syncState}
            onPlay={play}
            onPause={pause}
            onSeek={seek}
            onRateChange={setRate}
            onToggleMute={toggleMuteAll}
          />

          <SyncVideoGrid angles={angles} currentTimeSec={syncState.currentTimeSec} registerVideoRef={register} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-court-700 bg-court-900/50 p-3">
            <button
              type="button"
              disabled={!hasVideos || isAnalyzing}
              onClick={runAnalysis}
              className="rounded-md bg-whistle-500 px-4 py-2 text-sm font-semibold text-court-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Run AI Review"}
            </button>
            <span className="text-xs text-court-300">
              Session: {session?.id ?? "not started"} | Status: {session?.status ?? "idle"} | WS: {isConnected ? "connected" : "offline"}
            </span>
          </div>

          {error ? <p className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">{error}</p> : null}
        </section>

        <aside className="space-y-4">
          <VerdictCard verdict={verdict} isProcessing={isAnalyzing} />
          <EvidenceTimeline evidence={verdict?.evidence ?? []} onJumpToTime={seek} />
        </aside>
      </div>
    </main>
  );
}
