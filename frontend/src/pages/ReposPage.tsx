import { LoadError } from "../components/LoadError";
import { RepoCard, RepoCardSkeleton } from "../components/repos/RepoCard";
import { Reveal } from "../components/Reveal";
import { catalogTotals, formatNumber } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";

export function ReposPage() {
  useDocumentTitle("Repositories");
  const { repos, error, reload } = useRepos();
  const totals = repos ? catalogTotals(repos) : null;

  return (
    <div className="relative">
      <div aria-hidden="true" className="bg-grid absolute inset-x-0 top-0 h-80 opacity-40 mask-[linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Repositories</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance text-chalk sm:text-5xl">
            Pick a codebase to explore
          </h1>
          <p className="mt-5 leading-relaxed text-mist">
            For each repository, the source and tests, the 200 most recent commits, and the 100 most recently merged pull
            requests are indexed for search. New repositories come online gradually: the free embedding quota covers about a
            thousand chunks a day.
          </p>
          {totals && (
            <p className="mt-6 font-mono text-xs text-mist/80">
              {formatNumber(totals.repos)} repositories · {formatNumber(totals.chunks)} searchable chunks ·{" "}
              {formatNumber(totals.history)} commits & pull requests
            </p>
          )}
        </Reveal>

        <div className="mt-12">
          {error ? (
            <div className="max-w-xl">
              <LoadError message={error} onRetry={reload} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {repos
                ? repos.map((repo, index) => (
                    <Reveal key={repo.id} delay={Math.min(index, 6) * 60}>
                      <RepoCard repo={repo} />
                    </Reveal>
                  ))
                : [0, 1, 2, 3, 4, 5].map((n) => <RepoCardSkeleton key={n} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
