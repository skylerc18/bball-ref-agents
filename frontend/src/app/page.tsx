"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/common/Header";
import { MultiAngleUploader } from "@/components/upload/MultiAngleUploader";
import { SyncVideoGrid } from "@/components/review/SyncVideoGrid";
import { PlaybackControls } from "@/components/review/PlaybackControls";
import { useClipUpload } from "@/hooks/useClipUpload";
import { useSession } from "@/hooks/useSession";
import { useSyncedPlayback } from "@/hooks/useSyncedPlayback";
import { useWebSocket } from "@/hooks/useWebSocket";
import { createSessionFromExample, listExamples, uploadAngles } from "@/lib/api";
import type { ExampleSummary } from "@/types/api";

export default function Page() {
  const router = useRouter();
  const { angles, setFromFiles, setFromRemote, clear } = useClipUpload();
  const { session, ensureSession, setSession } = useSession();
  const { isConnected } = useWebSocket(session?.id ?? null, false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleSummary[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoadingExamples(true);
      try {
        const res = await listExamples();
        if (isMounted) {
          setExamples(res.examples);
        }
      } catch {
        if (isMounted) {
          setError("Unable to load built-in examples.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingExamples(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const angleIds = useMemo(() => angles.map((angle) => angle.id), [angles]);

  const { syncState, register, play, pause, seek, setRate, toggleMuteAll, hasVideos } =
    useSyncedPlayback(angleIds);

  const onClearAll = () => {
    clear();
    setError(null);
    setSelectedExampleId(null);
    if (session) {
      setSession({ ...session, status: "idle" });
    }
  };

  const onFilesSelected = (files: FileList | null) => {
    setSelectedExampleId(null);
    if (session) {
      setSession(null);
    }
    setFromFiles(files);
  };

  const onSelectExample = async (example: ExampleSummary) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await createSessionFromExample(example.exampleId);
      setSession(res.session);
      setSelectedExampleId(example.exampleId);
      setFromRemote(example.clips);
    } catch {
      setError("Unable to load example session.");
    } finally {
      setIsSubmitting(false);
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
      const hasUploadedFiles = angles.some((angle) => Boolean(angle.file));
      let activeSession = session;

      if (selectedExampleId) {
        if (!activeSession) {
          throw new Error("Example session is missing.");
        }
      } else {
        activeSession = await ensureSession();
        setSession({ ...activeSession, status: "uploading" });
        if (hasUploadedFiles) {
          await uploadAngles({ sessionId: activeSession.id, angles });
        }
      }

      if (!activeSession) {
        throw new Error("Session unavailable.");
      }
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
        <section className="rounded-2xl border border-court-700/70 bg-court-900/60 p-4 shadow-panel">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-white">Built-In Example Clips</h2>
            <p className="text-sm text-court-300">Pick an example to preload clips and metadata without uploading.</p>
          </div>
          {isLoadingExamples ? (
            <p className="text-sm text-court-300">Loading examples...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {examples.map((example) => (
                <button
                  key={example.exampleId}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onSelectExample(example)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedExampleId === example.exampleId
                      ? "border-whistle-500 bg-court-800"
                      : "border-court-600 bg-court-950/40 hover:border-court-400"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{example.title}</p>
                  <p className="mt-1 text-xs text-court-300">{example.description ?? "No description"}</p>
                  <p className="mt-2 text-xs text-court-400">{example.clipCount} clips</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <MultiAngleUploader angles={angles} onFilesSelected={onFilesSelected} onClear={onClearAll} />

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
