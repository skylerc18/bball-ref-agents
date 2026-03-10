"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/common/Header";
import { MultiAngleUploader } from "@/components/upload/MultiAngleUploader";
import { SyncVideoGrid } from "@/components/review/SyncVideoGrid";
import { PlaybackControls } from "@/components/review/PlaybackControls";
import { useClipUpload } from "@/hooks/useClipUpload";
import { useSession } from "@/hooks/useSession";
import { useSyncedPlayback } from "@/hooks/useSyncedPlayback";
import { useWebSocket } from "@/hooks/useWebSocket";
import { uploadAngles } from "@/lib/api";

export default function Page() {
  const router = useRouter();
  const { angles, setFromFiles, clear } = useClipUpload();
  const { session, ensureSession, setSession } = useSession();
  const { isConnected } = useWebSocket(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const angleIds = useMemo(() => angles.map((angle) => angle.id), [angles]);

  const { syncState, register, play, pause, seek, setRate, toggleMuteAll, hasVideos } =
    useSyncedPlayback(angleIds);

  const onClearAll = () => {
    clear();
    setError(null);
    if (session) {
      setSession({ ...session, status: "idle" });
    }
  };

  const goToVerdict = async () => {
    setError(null);

    if (angles.length === 0) {
      setError("Upload at least one video angle before generating a verdict.");
      return;
    }

    setIsSubmitting(true);

    try {
      const activeSession = await ensureSession();
      setSession({ ...activeSession, status: "uploading" });

      await uploadAngles({ sessionId: activeSession.id, angles });
      setSession({ ...activeSession, status: "processing" });

      router.push(`/verdict?sessionId=${encodeURIComponent(activeSession.id)}`);
    } catch {
      setError("Upload failed. Please retry.");
      if (session) {
        setSession({ ...session, status: "error" });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-court-950 via-court-900 to-court-950 text-white">
      <Header />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-8">
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
            disabled={!hasVideos || isSubmitting}
            onClick={goToVerdict}
            className="rounded-md bg-whistle-500 px-4 py-2 text-sm font-semibold text-court-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Preparing Verdict..." : "Generate AI Verdict"}
          </button>
          <span className="text-xs text-court-300">
            Session: {session?.id ?? "not started"} | Status: {session?.status ?? "idle"} | WS: {isConnected ? "connected" : "offline"}
          </span>
        </div>

        {error ? <p className="rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}
