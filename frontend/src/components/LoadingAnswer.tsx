import { useEffect, useState } from "react";

/** After this long, the backend is probably waking up from free-tier sleep. */
const SLOW_AFTER_SECONDS = 15;

export function LoadingAnswer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <div role="status" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
        </span>
        <span>Searching the codebase and writing an answer…</span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{seconds}s</span>
      </div>
      {seconds >= SLOW_AFTER_SECONDS && (
        <p className="mt-2 text-xs text-slate-500">
          Still working. If the server has been idle, it can take up to a minute to wake up.
        </p>
      )}
    </div>
  );
}
