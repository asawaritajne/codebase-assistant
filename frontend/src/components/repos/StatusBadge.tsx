import { indexedPercent } from "../../lib/format";
import type { RepoIndexStatus, RepoSummary } from "../../types";

const STYLES: Record<RepoIndexStatus, string> = {
  ready: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25",
  indexing: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
  queued: "bg-glow/15 text-glow ring-glow/25",
  "not-ingested": "bg-white/8 text-mist ring-white/10",
};

export function statusLabel(repo: RepoSummary): string {
  switch (repo.status) {
    case "ready":
      return "Ready";
    case "indexing":
      return `Indexing · ${indexedPercent(repo)}%`;
    case "queued":
      return "Queued";
    case "not-ingested":
      return "Coming soon";
  }
}

export function StatusBadge({ repo }: { repo: RepoSummary }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-medium whitespace-nowrap ring-1 ${STYLES[repo.status]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(repo)}
    </span>
  );
}
