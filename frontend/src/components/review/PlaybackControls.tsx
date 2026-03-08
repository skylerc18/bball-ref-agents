"use client";

import { PLAYBACK_RATES } from "@/lib/constants";
import { formatClock } from "@/lib/time";
import type { SyncState } from "@/types/domain";

type Props = {
  state: SyncState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (sec: number) => void;
  onRateChange: (rate: number) => void;
  onToggleMute: (muted: boolean) => void;
};

export function PlaybackControls({ state, onPlay, onPause, onSeek, onRateChange, onToggleMute }: Props) {
  return (
    <div className="rounded-xl border border-court-700 bg-court-900/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={state.isPlaying ? onPause : onPlay}
          className="rounded-md bg-whistle-500 px-4 py-2 text-sm font-semibold text-court-950 hover:bg-whistle-400"
        >
          {state.isPlaying ? "Pause" : "Play"}
        </button>

        <label className="text-sm text-court-300">
          Rate
          <select
            className="ml-2 rounded-md border border-court-500 bg-court-950 px-2 py-1 text-white"
            value={state.playbackRate}
            onChange={(event) => onRateChange(Number(event.target.value))}
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onToggleMute(true)}
          className="rounded-md border border-court-500 px-3 py-2 text-sm text-court-300 hover:bg-court-700/40"
        >
          Mute All
        </button>
        <button
          type="button"
          onClick={() => onToggleMute(false)}
          className="rounded-md border border-court-500 px-3 py-2 text-sm text-court-300 hover:bg-court-700/40"
        >
          Unmute All
        </button>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={Math.max(state.durationSec, 0.001)}
          value={state.currentTimeSec}
          step={0.01}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="w-full accent-whistle-500"
        />
        <div className="mt-1 flex justify-between text-xs text-court-300">
          <span>{formatClock(state.currentTimeSec)}</span>
          <span>{formatClock(state.durationSec)}</span>
        </div>
      </div>
    </div>
  );
}
