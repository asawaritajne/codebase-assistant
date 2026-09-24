import { useState, type FormEvent } from "react";
import { ApiError, queryEmbeddingMap } from "../api";
import type { MapQueryResult } from "../types";

const EXAMPLES = ["how are retries handled?", "how does caching work?", "how is state updated?"];

interface QuerySearchProps {
  onResult: (result: MapQueryResult | null) => void;
  result: MapQueryResult | null;
}

/**
 * Runs the retrieval half of the pipeline on its own: the question is embedded and matched, but no
 * answer is generated, so it costs one embedding and comes back in about a second.
 */
export function QuerySearch({ onResult, result }: QuerySearchProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (question: string) => {
    setBusy(true);
    setError(null);
    try {
      onResult(await queryEmbeddingMap(question));
    } catch (err) {
      onResult(null);
      setError(err instanceof ApiError ? err.message : "Couldn't place that question.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = value.trim();
    if (question && !busy) void run(question);
  };

  const clear = () => {
    setValue("");
    setError(null);
    onResult(null);
  };

  return (
    <div className="border-b border-white/8 bg-deep/60 px-5 py-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <label htmlFor="map-query" className="sr-only">
          Place a question in the map
        </label>
        <input
          id="map-query"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a question to see where it lands…"
          maxLength={300}
          className="glass min-w-0 flex-1 rounded-xl px-3.5 py-2 text-sm text-chalk placeholder:text-mist/60 focus:border-glow/40 focus:ring-2 focus:ring-glow/20 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="rounded-xl bg-linear-to-r from-glow to-iris px-4 py-2 text-sm font-semibold text-void transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-mist"
        >
          {busy ? "Placing…" : "Place it"}
        </button>
        {result && (
          <button type="button" onClick={clear} className="rounded-xl px-3 py-2 text-sm text-mist hover:text-chalk">
            Clear
          </button>
        )}
      </form>

      {!result && !error && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist/70">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={busy}
              onClick={() => {
                setValue(example);
                void run(example);
              }}
              className="rounded-full border border-white/10 px-2.5 py-1 transition-colors hover:border-glow/40 hover:text-chalk disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-ember">{error}</p>}

      {result && (
        <div className="mt-3">
          <p className="font-mono text-[0.7rem] tracking-wide text-mist/80">
            the white star is your question · the {result.neighbours.length} chunks it would retrieve are lit up
          </p>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {result.neighbours.map((neighbour, index) => (
              <li key={neighbour.key}>
                <a
                  href={neighbour.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-xs transition-colors hover:border-glow/30"
                >
                  <span className="font-mono font-semibold text-glow">S{index + 1}</span>
                  <span className="min-w-0 truncate font-mono text-mist">{neighbour.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-mist/60">{neighbour.score.toFixed(2)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
