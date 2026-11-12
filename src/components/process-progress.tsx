export function ProcessProgress({ done, total, percent, overdue = false }: { done: number; total: number; percent: number; overdue?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${done} / ${total} lépés kész`}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8"
      >
        <div
          className={`pg-grow h-full rounded-full ${percent === 100 ? "bg-emerald-400/80" : overdue ? "bg-gradient-to-r from-amber-300 to-red-400" : "bg-gradient-to-r from-rose-bright via-rose to-pink"}`}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold text-white/60 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}
