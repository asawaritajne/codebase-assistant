import { Link } from "react-router";
import { AnswerPreview } from "../components/home/AnswerPreview";
import { LoadError } from "../components/LoadError";
import { RepoCard, RepoCardSkeleton } from "../components/repos/RepoCard";
import { Reveal } from "../components/Reveal";
import { GalaxySection } from "../galaxy/GalaxySection";
import { HeroBackdrop } from "../galaxy/HeroBackdrop";
import { catalogTotals, formatNumber } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useTilt } from "../lib/useTilt";
import { useRepos } from "../repos/ReposContext";
import { SITE_NAME } from "../site";

const FEATURES = [
  {
    title: "Grounded in the source",
    body: "Answers are written only from code, tests, commits, and pull requests retrieved for your question, never from what a model half-remembers about a library.",
    icon: "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5",
  },
  {
    title: "Cited to the exact lines",
    body: "Every claim carries a citation that opens the file on GitHub at the lines it came from, pinned to the commit that was indexed.",
    icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
  },
  {
    title: "Checked before you read it",
    body: "Citations are verified automatically. An answer that cites a source that doesn't exist is rewritten, and anything still untraceable is flagged.",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
];

const STEPS = [
  { title: "Ingest", body: "Source files, tests, commits, and merged PRs are pulled from GitHub." },
  { title: "Chunk & embed", body: "Code is split at block boundaries and turned into vectors with Gemini." },
  { title: "Retrieve", body: "Your question is matched by meaning against that repository's chunks." },
  { title: "Answer & verify", body: "Gemini answers from the matches alone, and every citation is checked." },
];

const STACK = [
  { name: "React + TypeScript", role: "Website" },
  { name: "three.js", role: "3D visualization" },
  { name: "Node.js + Express", role: "API" },
  { name: "MongoDB Atlas", role: "Storage + vector search" },
  { name: "Google Gemini", role: "Embeddings + answers" },
  { name: "GitHub REST API", role: "Source data" },
];

function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
  const tilt = useTilt<HTMLDivElement>();
  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      style={tilt.style}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm will-change-transform hover:shadow-lg"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d={feature.icon} />
        </svg>
      </span>
      <h3 className="mt-5 font-semibold text-slate-900">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle();
  const { repos, error, reload } = useRepos();
  const totals = repos ? catalogTotals(repos) : null;
  const startRepo = repos?.find((repo) => repo.stats.chunks > 0)?.id ?? "react-hook-form";

  const heroStats = [
    { label: "Repositories", value: totals?.repos },
    { label: "Searchable chunks", value: totals?.chunks },
    { label: "Commits & PRs", value: totals?.history },
  ];

  return (
    <>
      {/* Hero, with the live embedding cloud drifting behind it */}
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_10%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(50%_50%_at_85%_30%,rgba(244,63,94,0.18),transparent_60%)]"
        />
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1.05fr_1fr]">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur">
              <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-indigo-400" />
              Retrieval-augmented generation over real open-source code
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              Ask a codebase anything. <span className="text-indigo-400">Check every answer.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-slate-300">
              {SITE_NAME} reads the source code, tests, commits, and pull requests of popular open-source libraries, then
              answers your questions using only what it found, with every claim linked to the exact lines on GitHub.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={`/ask/${startRepo}`}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-950/40 transition-transform hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Start asking
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/10"
              >
                See how it works
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-slate-400">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {stat.value === undefined ? "…" : formatNumber(stat.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={150}>
            <AnswerPreview />
          </Reveal>
        </div>
      </section>

      {/* The embedding galaxy */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <GalaxySection
            heading="Every indexed chunk, in one space"
            intro="Before a question can be answered, each piece of code, commit, and pull request is turned into a list of numbers that captures its meaning. Here is that space, flattened to three dimensions — the same one a question is matched against."
          />
        </Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl border-t border-slate-200 px-4 py-20 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-semibold text-indigo-600">Why trust the answers</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Every answer shows its work</h2>
          <p className="mt-4 text-slate-600">
            AI chat about code usually sounds confident whether or not it's right. Here, you can check each statement against
            the code it came from in one click.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 90}>
              <FeatureCard feature={feature} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Repositories */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-indigo-600">Repositories</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Well-known libraries, ready to question</h2>
              <p className="mt-4 text-slate-600">From form handling to build tooling, each one indexed from its real source.</p>
            </div>
            <Link to="/repos" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
              View all repositories <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <div className="mt-10">
            {error ? (
              <LoadError message={error} onRetry={reload} />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {repos
                  ? repos.slice(0, 6).map((repo, index) => (
                      <Reveal key={repo.id} delay={index * 60}>
                        <RepoCard repo={repo} />
                      </Reveal>
                    ))
                  : [0, 1, 2].map((n) => <RepoCardSkeleton key={n} />)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works teaser */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">From GitHub to a cited answer</h2>
          </div>
          <Link to="/how-it-works" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Read the full breakdown <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <li className="border-t-2 border-slate-900 pt-5">
                <span className="font-mono text-xs font-semibold text-indigo-600">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Stack */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <Reveal>
          <h2 className="text-sm font-semibold text-slate-900">Built with</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STACK.map((item) => (
              <li key={item.name} className="rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:border-indigo-300">
                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.role}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Call to action */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-center sm:px-12">
            <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-20 invert" />
            <h2 className="relative text-3xl font-semibold tracking-tight text-balance text-white">
              Pick a repository and start asking
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-slate-300">
              Ask how something works, why it changed, or where it lives, and follow the citations straight into the code.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={`/ask/${startRepo}`}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Start asking
              </Link>
              <Link to="/repos" className="rounded-xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
                Browse repositories
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
