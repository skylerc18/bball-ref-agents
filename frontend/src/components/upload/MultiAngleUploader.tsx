"use client";

import { MAX_VIDEO_ANGLES } from "@/lib/constants";
import type { CameraAngle } from "@/types/domain";

type Props = {
  angles: CameraAngle[];
  onFilesSelected: (files: FileList | null) => void;
  onClear: () => void;
};

function formatSize(sizeBytes: number): string {
  if (sizeBytes <= 0) {
    return "Built-in clip";
  }
  const mb = sizeBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function MultiAngleUploader({ angles, onFilesSelected, onClear }: Props) {
  return (
    <section className="rounded-2xl border border-court-700/70 bg-court-900/60 p-4 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Upload Camera Angles</h2>
          <p className="text-sm text-court-300">Select up to {MAX_VIDEO_ANGLES} clips of the same play.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-court-500 px-3 py-1.5 text-sm text-court-300 hover:bg-court-700/40"
        >
          Clear
        </button>
      </div>

      <label className="mt-4 block cursor-pointer rounded-xl border border-dashed border-court-500 bg-court-950/50 p-5 text-center hover:border-whistle-500">
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(event) => onFilesSelected(event.target.files)}
        />
        <span className="text-sm text-court-300">Click to choose video files</span>
      </label>

      {angles.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {angles.map((angle) => (
            <li key={angle.id} className="flex items-center justify-between rounded-lg bg-court-950/60 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-white">{angle.label}</p>
                <p className="text-court-300">{angle.fileName}</p>
              </div>
              <span className="text-court-300">{formatSize(angle.fileSize)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
