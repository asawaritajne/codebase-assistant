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
    <div role="status" className="glass rounded-2xl px-5 py-4 text-sm text-mist">
      <div className="flex items-center gap-3">
        <span className="flex gap-1" aria-hidden="true">
          <span className="size-2 animate-bounce rounded-full bg-glow [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-iris [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-ember" />
        </span>
        <span>Searching the codebase and writing an answer…</span>
        <span className="ml-auto font-mono text-xs text-mist/70 tabular-nums">{seconds}s</span>
      </div>
      {seconds >= SLOW_AFTER_SECONDS && (
        <p className="mt-2 text-xs text-mist/70">
          Still working. Google's free tier throttles heavily at times, and a sleeping server can take a minute to wake.
        </p>
      )}
    </div>
  );
}
