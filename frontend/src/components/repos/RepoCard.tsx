import { Link } from "react-router";
import { formatCompact, formatNumber } from "../../lib/format";
import type { RepoSummary } from "../../types";
import { RepoMark } from "./RepoMark";
import { StatusBadge } from "./StatusBadge";

export function RepoCard({ repo }: { repo: RepoSummary }) {
  const askable = repo.stats.chunks > 0;
  const ingested = repo.status !== "not-ingested";
  const stats = [
    { label: "Files", value: repo.stats.files },
    { label: "Commits", value: repo.stats.commits },
    { label: "PRs", value: repo.stats.pullRequests },
  ];

  return (
    <article className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RepoMark repoId={repo.id} name={repo.name} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{repo.name}</h3>
            <p className="truncate font-mono text-xs text-slate-500">{repo.fullName}</p>
          </div>
        </div>
        <StatusBadge repo={repo} />
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">{repo.description}</p>

      <dl className="mt-5 grid grid-cols-3 rounded-xl bg-slate-50 py-2.5 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-[0.7rem] font-medium tracking-wide text-slate-500 uppercase">{stat.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">{ingested ? formatNumber(stat.value) : "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-500">
          {repo.category}
          {repo.stars !== null && (
            <>
              {" · "}
              <span aria-label={`${formatNumber(repo.stars)} GitHub stars`}>★ {formatCompact(repo.stars)}</span>
            </>
          )}
        </span>
        {askable ? (
          <Link
            to={`/ask/${repo.id}`}
            className="shrink-0 font-medium text-indigo-600 after:absolute after:inset-0 after:rounded-2xl hover:text-indigo-500"
          >
            Ask questions <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="shrink-0 text-slate-400">Available soon</span>
        )}
      </div>
    </article>
  );
}

export function RepoCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3.5 w-28 rounded bg-slate-200" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
      </div>
      <div className="mt-5 h-14 rounded-xl bg-slate-50" />
    </div>
  );
}
