import { useId, useState } from "react";
import type { AnswerSource, SourceType } from "../types";

const TYPE_BADGES: Record<SourceType, { label: string; className: string }> = {
  code: { label: "Code", className: "bg-glow/15 text-glow ring-glow/25" },
  commit: { label: "Commit", className: "bg-amber-400/15 text-amber-200 ring-amber-400/25" },
  pr: { label: "Pull request", className: "bg-iris/20 text-violet-200 ring-iris/30" },
};

const EXCERPT_LINES = 6;
const EXCERPT_CHARS = 320;

function excerpt(source: AnswerSource): string {
  if (source.type === "code") {
    const lines = source.text.split("\n");
    const shown = lines.slice(0, EXCERPT_LINES).join("\n");
    return lines.length > EXCERPT_LINES ? `${shown}\n…` : shown;
  }
  const prose = source.text.replace(/\s+/g, " ").trim();
  return prose.length > EXCERPT_CHARS ? `${prose.slice(0, EXCERPT_CHARS)}…` : prose;
}

export function SourcesPanel({ sources }: { sources: AnswerSource[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (sources.length === 0) return null;

  const citedCount = sources.filter((source) => source.cited).length;

  return (
    <section className="mt-4 border-t border-white/8 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex items-center gap-1.5 rounded text-sm font-medium text-mist transition-colors hover:text-chalk"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
            clipRule="evenodd"
          />
        </svg>
        Sources ({sources.length})<span className="font-normal text-mist/70">· {citedCount} cited</span>
      </button>

      <ol id={listId} hidden={!open} className="mt-3 space-y-3">
        {sources.map((source) => {
          const badge = TYPE_BADGES[source.type];
          const lines = source.startLine ? ` · lines ${source.startLine}–${source.endLine}` : "";
          // A commit or PR with no description has only its title as text; don't show it twice.
          const showExcerpt = !source.title.includes(source.text.trim());
          return (
            <li
              key={source.marker}
              className={`rounded-xl border border-white/8 bg-white/[0.03] p-3 ${source.cited ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-mono font-semibold text-glow">{source.marker}</span>
                <span className={`rounded px-1.5 py-0.5 font-medium ring-1 ${badge.className}`}>{badge.label}</span>
                {source.isTest && <span className="rounded bg-white/8 px-1.5 py-0.5 font-medium text-mist">Test file</span>}
                {!source.cited && <span className="text-mist/70">Not cited in the answer</span>}
              </div>
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block font-mono text-sm wrap-break-word text-chalk transition-colors hover:text-glow"
              >
                {source.title}
                {lines}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> (opens on GitHub in a new tab)</span>
              </a>
              {showExcerpt && (
                <pre
                  className={`mt-2 max-h-40 overflow-auto rounded-lg bg-void/70 p-2.5 text-xs leading-relaxed text-mist ${
                    source.type === "code" ? "font-mono" : "font-sans whitespace-pre-wrap"
                  }`}
                >
                  {excerpt(source)}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
