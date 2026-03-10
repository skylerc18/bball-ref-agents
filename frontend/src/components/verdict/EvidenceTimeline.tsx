"use client";

import { formatClock } from "@/lib/time";
import type { EvidenceItem } from "@/types/domain";

type Props = {
  evidence: EvidenceItem[];
  onJumpToTime?: (timeSec: number) => void;
};

export function EvidenceTimeline({ evidence, onJumpToTime }: Props) {
  return (
    <section className="rounded-2xl border border-court-700 bg-court-900/60 p-4 shadow-panel">
      <h2 className="text-lg font-semibold text-white">Evidence</h2>

      {evidence.length === 0 ? <p className="mt-3 text-sm text-court-300">No evidence points available.</p> : null}

      {evidence.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {evidence.map((item) => (
            <li key={item.id} className="rounded-lg border border-court-700 bg-court-950/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {item.angleId} at {formatClock(item.timestampSec)}
                  </p>
                  <p className="mt-1 text-sm text-court-300">{item.reason}</p>
                </div>
                {onJumpToTime ? (
                  <button
                    type="button"
                    onClick={() => onJumpToTime(item.timestampSec)}
                    className="rounded-md border border-whistle-500/60 px-2 py-1 text-xs text-whistle-400 hover:bg-whistle-500/10"
                  >
                    Jump
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
