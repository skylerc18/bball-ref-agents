"use client";

import { formatClock } from "@/lib/time";
import type { CameraAngle } from "@/types/domain";

type Props = {
  angle: CameraAngle;
  currentTimeSec: number;
  registerVideoRef: (angleId: string, element: HTMLVideoElement | null) => void;
};

export function VideoPane({ angle, currentTimeSec, registerVideoRef }: Props) {
  return (
    <article className="rounded-xl border border-court-700 bg-court-950/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{angle.label}</h3>
        <span className="text-xs text-court-300">T+{formatClock(currentTimeSec)}</span>
      </div>
      <video
        ref={(el) => registerVideoRef(angle.id, el)}
        src={angle.srcUrl}
        controls={false}
        playsInline
        className="aspect-video w-full rounded-md bg-black"
      />
    </article>
  );
}
