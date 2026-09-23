import { Link } from "react-router";
import { formatCompact, formatNumber } from "../../lib/format";
import { repoColor } from "../../lib/repoColors";
import { useTilt } from "../../lib/useTilt";
import type { RepoSummary } from "../../types";
import { RepoMark } from "./RepoMark";
import { StatusBadge } from "./StatusBadge";

export function RepoCard({ repo }: { repo: RepoSummary }) {
  const tilt = useTilt<HTMLElement>(6);
  const askable = repo.stats.chunks > 0;
  const ingested = repo.status !== "not-ingested";
  const stats = [
    { label: "Files", value: repo.stats.files },
    { label: "Commits", value: repo.stats.commits },
    { label: "PRs", value: repo.stats.pullRequests },
  ];

  return (
    <article
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      style={tilt.style}
      className="glass glass-hover group relative flex flex-col overflow-hidden rounded-2xl p-5 will-change-transform"
    >
      {/* A wash of the repository's own colour, brightening on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: repoColor(repo.id) }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RepoMark repoId={repo.id} name={repo.name} />
          <div className="min-w-0">
            <h3 className="truncate font-display font-semibold text-chalk">{repo.name}</h3>
            <p className="truncate font-mono text-xs text-mist/80">{repo.fullName}</p>
          </div>
        </div>
        <StatusBadge repo={repo} />
      </div>

      <p className="relative mt-4 flex-1 text-sm leading-relaxed text-mist">{repo.description}</p>

      <dl className="relative mt-5 grid grid-cols-3 rounded-xl border border-white/8 bg-void/40 py-2.5 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="font-mono text-[0.65rem] tracking-wider text-mist/70 uppercase">{stat.label}</dt>
            <dd className="mt-0.5 font-display text-sm font-semibold text-chalk tabular-nums">
              {ingested ? formatNumber(stat.value) : "—"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-mist/80">
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
            className="shrink-0 font-semibold text-glow after:absolute after:inset-0 after:rounded-2xl hover:text-chalk"
          >
            Ask <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="shrink-0 text-mist/60">Indexing soon</span>
        )}
      </div>
    </article>
  );
}

export function RepoCardSkeleton() {
  return (
    <div aria-hidden="true" className="glass flex animate-pulse flex-col rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-white/10" />
        <div className="space-y-2">
          <div className="h-3.5 w-28 rounded bg-white/10" />
          <div className="h-3 w-40 rounded bg-white/5" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-4/5 rounded bg-white/5" />
      </div>
      <div className="mt-5 h-14 rounded-xl bg-white/5" />
    </div>
  );
}
