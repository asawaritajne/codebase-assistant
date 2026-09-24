import { Link } from "react-router";
import { formatCompact, formatNumber, indexedPercent } from "../../lib/format";
import { repoColor } from "../../lib/repoColors";
import type { RepoSummary } from "../../types";

const STATUS_TEXT: Record<RepoSummary["status"], string> = {
  ready: "text-emerald-300",
  indexing: "text-amber-200",
  queued: "text-glow",
  "not-ingested": "text-mist/60",
};

function statusWord(repo: RepoSummary): string {
  switch (repo.status) {
    case "ready":
      return "ready";
    case "indexing":
      return `indexing ${indexedPercent(repo)}%`;
    case "queued":
      return "queued";
    case "not-ingested":
      return "soon";
  }
}

/**
 * One catalogue entry. Laid out like an index in a reference book: a number, the name, the facts in
 * monospace columns, and a rule underneath — rather than another rounded card.
 */
function RepoRow({ repo, index }: { repo: RepoSummary; index: number }) {
  const askable = repo.stats.chunks > 0;
  const ingested = repo.status !== "not-ingested";

  const body = (
    <>
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-0 w-px transition-all duration-200 group-hover:w-1"
        style={{ background: repoColor(repo.id) }}
      />
      <span className="col-span-full flex items-baseline gap-4 md:col-span-4">
        <span className="font-mono text-xs text-mist/50 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="display block text-2xl text-chalk transition-colors group-hover:text-glow">{repo.name}</span>
          <span className="mt-0.5 block truncate font-mono text-xs text-mist/70">{repo.fullName}</span>
        </span>
      </span>

      <span className="col-span-full text-sm leading-relaxed text-mist md:col-span-4">{repo.description}</span>

      <span className="col-span-full font-mono text-xs text-mist/80 md:col-span-2">
        {ingested ? (
          <>
            {formatNumber(repo.stats.files)} files
            <span className="mx-1.5 text-mist/40">/</span>
            {formatNumber(repo.stats.commits)} commits
            <span className="mx-1.5 text-mist/40">/</span>
            {formatNumber(repo.stats.pullRequests)} PRs
          </>
        ) : (
          "not ingested"
        )}
        {repo.stars !== null && (
          <span className="mt-1 block text-mist/50">
            {repo.category} · ★ {formatCompact(repo.stars)}
          </span>
        )}
      </span>

      <span className="col-span-full flex items-center justify-between gap-3 md:col-span-2 md:justify-end">
        <span className={`font-mono text-xs ${STATUS_TEXT[repo.status]}`}>{statusWord(repo)}</span>
        <span className={`font-mono text-xs ${askable ? "text-chalk" : "text-mist/40"}`}>
          {askable ? "ask →" : "—"}
        </span>
      </span>
    </>
  );

  const className =
    "row-entry group relative grid grid-cols-1 items-baseline gap-x-6 gap-y-2 px-4 py-6 md:grid-cols-12 md:px-6";

  return askable ? (
    <Link to={`/ask/${repo.id}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={`${className} cursor-default`}>{body}</div>
  );
}

export function RepoIndex({ repos }: { repos: RepoSummary[] }) {
  return (
    <div className="border-t border-white/10">
      {repos.map((repo, index) => (
        <RepoRow key={repo.id} repo={repo} index={index} />
      ))}
    </div>
  );
}

export function RepoIndexSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse border-t border-white/10">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="row-entry grid grid-cols-1 gap-3 px-4 py-6 md:grid-cols-12 md:px-6">
          <div className="md:col-span-4">
            <div className="h-6 w-40 rounded bg-white/10" />
            <div className="mt-2 h-3 w-52 rounded bg-white/5" />
          </div>
          <div className="h-3 w-full rounded bg-white/5 md:col-span-4" />
          <div className="h-3 w-40 rounded bg-white/5 md:col-span-4" />
        </div>
      ))}
    </div>
  );
}
