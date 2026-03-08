export function Header() {
  return (
    <header className="border-b border-court-700/60 bg-court-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-court-300">Agent-Powered Officiating</p>
          <h1 className="text-xl font-semibold text-white">AI Basketball Ref MVP</h1>
        </div>
        <div className="rounded-full border border-whistle-500/60 px-3 py-1 text-xs font-medium text-whistle-400">
          Multi-Angle Review
        </div>
      </div>
    </header>
  );
}
