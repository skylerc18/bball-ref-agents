"use client";

import type { CameraAngle } from "@/types/domain";
import { VideoPane } from "@/components/review/VideoPane";

type Props = {
  angles: CameraAngle[];
  currentTimeSec: number;
  registerVideoRef: (angleId: string, element: HTMLVideoElement | null) => void;
};

export function SyncVideoGrid({ angles, currentTimeSec, registerVideoRef }: Props) {
  if (angles.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-court-600 bg-court-950/40 p-10 text-center text-court-300">
        Upload at least one angle to begin synced playback review.
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {angles.map((angle) => (
        <VideoPane
          key={angle.id}
          angle={angle}
          currentTimeSec={currentTimeSec}
          registerVideoRef={registerVideoRef}
        />
      ))}
    </section>
  );
}
