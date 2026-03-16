import type { Verdict } from "@/types/domain";

type Props = {
  verdict: Verdict | null;
  isProcessing: boolean;
};

function levelStyles(level: Verdict["level"]) {
  if (level === "upheld") {
    return "bg-green-500/20 text-green-300 border-green-400/50";
  }
  if (level === "overruled") {
    return "bg-blue-500/20 text-blue-300 border-blue-400/50";
  }
  return "bg-yellow-500/20 text-yellow-300 border-yellow-400/50";
}

export function VerdictCard({ verdict, isProcessing }: Props) {
  return (
    <section className="rounded-2xl border border-court-700 bg-court-900/60 p-4 shadow-panel">
      <h2 className="text-lg font-semibold text-white">Verdict</h2>

      {isProcessing ? <p className="mt-3 text-sm text-court-300">Analyzing play and aggregating evidence...</p> : null}

      {!isProcessing && !verdict ? <p className="mt-3 text-sm text-court-300">No verdict yet. Run analysis after upload.</p> : null}

      {verdict ? (
        <div className="mt-4 space-y-3">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase ${levelStyles(verdict.level)}`}>
            {verdict.level}
          </span>
          <p className="text-sm text-court-200">{verdict.summary}</p>
          <p className="text-sm text-court-300">Confidence: {(verdict.confidence * 100).toFixed(0)}%</p>
        </div>
      ) : null}
    </section>
  );
}
