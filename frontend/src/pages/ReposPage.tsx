import { LoadError } from "../components/LoadError";
import { RepoIndex, RepoIndexSkeleton } from "../components/repos/RepoIndex";
import { Reveal } from "../components/Reveal";
import { catalogTotals, formatNumber } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";
import { SOURCE_URL } from "../site";

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

        {/*
          The obvious question on seeing a fixed list is whether you can add your own. Answering it
          here, with the reason, reads as a decision rather than a missing feature — and indexing a
          repository really does cost one to three days of the free embedding quota.
        */}
        <Reveal className="mt-16 border-t border-white/10 pt-8">
          <h2 className="display text-2xl text-chalk">Why thirteen, and not yours</h2>
          <div className="mt-4 grid gap-x-12 gap-y-4 text-sm leading-relaxed text-mist md:grid-cols-2">
            <p>
              Indexing one repository costs between 500 and 2,500 embeddings, against a free tier of about a thousand a
              day shared with answering questions. A single new codebase takes one to three days, so the catalogue is
              chosen in advance rather than open to any URL.
            </p>
            <p>
              The whole thing is open source, though. Clone it, add an entry to{" "}
              <span className="font-mono text-xs text-chalk">config/repos.ts</span>, point it at your own GitHub and
              Gemini keys, and it will index whatever you like —{" "}
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-glow transition-colors hover:text-chalk"
              >
                the setup is in the README <span aria-hidden="true">↗</span>
              </a>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
