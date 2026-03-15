"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DEFAULT_PLAYBACK_RATE } from "@/lib/constants";
import type { SyncState } from "@/types/domain";

type VideoMap = Record<string, HTMLVideoElement | null>;

export function useSyncedPlayback(angleIds: string[]) {
  const videosRef = useRef<VideoMap>({});
  const rafRef = useRef<number | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({
    currentTimeSec: 0,
    durationSec: 0,
    isPlaying: false,
    playbackRate: DEFAULT_PLAYBACK_RATE,
  });

  const getPrimary = useCallback(() => {
    const firstId = angleIds[0];
    return firstId ? videosRef.current[firstId] : null;
  }, [angleIds]);

  const updateClockFromPrimary = useCallback(() => {
    const primary = getPrimary();
    if (!primary) {
      return;
    }

    setSyncState((prev) => ({
      ...prev,
      currentTimeSec: primary.currentTime,
      durationSec: Number.isFinite(primary.duration) ? primary.duration : prev.durationSec,
    }));

    if (!primary.paused) {
      rafRef.current = requestAnimationFrame(updateClockFromPrimary);
    }
  }, [getPrimary]);

  const register = useCallback((angleId: string, element: HTMLVideoElement | null) => {
    videosRef.current[angleId] = element;
    if (element && Number.isFinite(element.duration)) {
      const nextDuration = Math.max(0, element.duration || 0);
      setSyncState((prev) => {
        if (nextDuration <= prev.durationSec) {
          return prev;
        }

        return { ...prev, durationSec: nextDuration };
      });
    }
  }, []);

  const syncAll = useCallback(
    (fn: (video: HTMLVideoElement) => void) => {
      angleIds.forEach((id) => {
        const video = videosRef.current[id];
        if (video) {
          fn(video);
        }
      });
    },
    [angleIds],
  );

  const play = useCallback(() => {
    syncAll((video) => {
      void video.play();
    });

    setSyncState((prev) => ({ ...prev, isPlaying: true }));
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(updateClockFromPrimary);
  }, [syncAll, updateClockFromPrimary]);

  const pause = useCallback(() => {
    syncAll((video) => video.pause());
    setSyncState((prev) => ({ ...prev, isPlaying: false }));

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [syncAll]);

  const seek = useCallback(
    (timeSec: number) => {
      syncAll((video) => {
        video.currentTime = timeSec;
      });

      setSyncState((prev) => ({ ...prev, currentTimeSec: timeSec }));
    },
    [syncAll],
  );

  const setRate = useCallback(
    (rate: number) => {
      syncAll((video) => {
        video.playbackRate = rate;
      });
      setSyncState((prev) => ({ ...prev, playbackRate: rate }));
    },
    [syncAll],
  );

  const toggleMuteAll = useCallback(
    (muted: boolean) => {
      syncAll((video) => {
        video.muted = muted;
      });
    },
    [syncAll],
  );

  const hasVideos = useMemo(() => angleIds.length > 0, [angleIds]);

  return {
    syncState,
    hasVideos,
    register,
    play,
    pause,
    seek,
    setRate,
    toggleMuteAll,
  };
}
