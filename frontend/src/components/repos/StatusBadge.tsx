import { indexedPercent } from "../../lib/format";
import type { RepoIndexStatus, RepoSummary } from "../../types";

const STYLES: Record<RepoIndexStatus, string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  indexing: "bg-amber-50 text-amber-800 ring-amber-200",
  queued: "bg-sky-50 text-sky-700 ring-sky-200",
  "not-ingested": "bg-slate-100 text-slate-600 ring-slate-200",
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${STYLES[repo.status]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(repo)}
    </span>
  );
}
