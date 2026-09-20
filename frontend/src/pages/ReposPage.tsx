import { LoadError } from "../components/LoadError";
import { RepoCard, RepoCardSkeleton } from "../components/repos/RepoCard";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";

export function ReposPage() {
  useDocumentTitle("Repositories");
  const { repos, error, reload } = useRepos();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 md:py-20">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold text-indigo-600">Repositories</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Pick a codebase to explore</h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          For each repository, the source code and tests, the 200 most recent commits, and the 100 most recently merged pull
          requests are indexed for search. New repositories come online gradually, because the free embedding quota covers
          about a thousand chunks a day.
        </p>
      </header>

      <div className="mt-12">
        {error ? (
          <div className="max-w-xl">
            <LoadError message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {repos ? repos.map((repo) => <RepoCard key={repo.id} repo={repo} />) : [0, 1, 2].map((n) => <RepoCardSkeleton key={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}
