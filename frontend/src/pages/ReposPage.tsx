import { LoadError } from "../components/LoadError";
import { RepoIndex, RepoIndexSkeleton } from "../components/repos/RepoIndex";
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
      <div aria-hidden="true" className="bg-grid absolute inset-x-0 top-0 h-80 opacity-30 mask-[linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-8">
            <div className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.25em] text-glow uppercase">The catalogue</p>
              <h1 className="display mt-4 text-5xl text-chalk sm:text-6xl">
                Thirteen codebases,
                <br />
                <span className="text-aurora italic">indexed line by line.</span>
              </h1>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-mist">
              Source and tests, the 200 most recent commits, and the 100 most recently merged pull requests of each. New
              entries arrive gradually — the free embedding quota covers about a thousand chunks a day.
            </p>
          </div>
          {totals && (
            <p className="mt-6 font-mono text-xs text-mist/70">
              {formatNumber(totals.repos)} repositories / {formatNumber(totals.chunks)} chunks /{" "}
              {formatNumber(totals.history)} commits & pull requests
            </p>
          )}
        </Reveal>

        <div className="mt-10">
          {error ? (
            <div className="max-w-xl">
              <LoadError message={error} onRetry={reload} />
            </div>
          ) : repos ? (
            <RepoIndex repos={repos} />
          ) : (
            <RepoIndexSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
