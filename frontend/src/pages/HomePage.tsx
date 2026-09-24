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
    accent: "from-glow/25",
  },
  {
    title: "Cited to the exact lines",
    body: "Every claim carries a citation that opens the file on GitHub at the lines it came from, pinned to the commit that was indexed.",
    icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
    accent: "from-iris/25",
  },
  {
    title: "Checked before you read it",
    body: "Citations are verified automatically. An answer that cites a source that doesn't exist is rewritten, and anything still untraceable is flagged.",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
    accent: "from-ember/25",
  },
];

function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
  const tilt = useTilt<HTMLDivElement>();
  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      style={tilt.style}
      className="glass glass-hover relative h-full overflow-hidden rounded-2xl p-6 will-change-transform"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 -top-24 h-40 bg-linear-to-b ${feature.accent} to-transparent blur-2xl`} />
      <span className="relative grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-glow">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d={feature.icon} />
        </svg>
      </span>
      <h3 className="relative mt-5 font-display font-semibold text-chalk">{feature.title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-mist">{feature.body}</p>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle();
  const { repos, error, reload } = useRepos();
  const totals = repos ? catalogTotals(repos) : null;
  const startRepo = repos?.find((repo) => repo.stats.chunks > 0)?.id ?? "react-hook-form";

  const heroStats = [
    { label: "repositories", value: totals?.repos },
    { label: "searchable chunks", value: totals?.chunks },
    { label: "commits & PRs", value: totals?.history },
  ];

  return (
    <>
      {/* Hero: the embedding cloud fills the viewport, text sits over a scrim */}
      <section className="relative isolate flex min-h-[min(calc(100dvh-4rem),760px)] items-center overflow-hidden">
        <HeroBackdrop />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_10%_20%,rgba(99,102,241,0.25),transparent_65%),radial-gradient(45%_45%_at_90%_80%,rgba(251,113,133,0.15),transparent_60%)]"
        />
        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.7rem] tracking-wider text-glow uppercase backdrop-blur">
              <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-glow" />
              retrieval-augmented generation
            </p>
            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl lg:leading-[1.05]">
              Ask a codebase anything.
              <span className="text-aurora block">Check every answer.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-mist">
              {SITE_NAME} reads the source, tests, commits, and pull requests of real open-source libraries, then answers
              from what it found — every claim linked to the exact lines on GitHub.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to={`/ask/${startRepo}`}
                className="rounded-xl bg-linear-to-r from-glow to-iris px-6 py-3.5 text-sm font-semibold text-void shadow-[0_18px_50px_-18px_var(--color-glow)] transition-transform hover:-translate-y-0.5"
              >
                Start asking
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-chalk transition-colors hover:border-glow/40 hover:bg-white/5"
              >
                See how it works
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <dd className="font-display text-3xl font-semibold tracking-tight text-chalk tabular-nums">
                    {stat.value === undefined ? "—" : formatNumber(stat.value)}
                  </dd>
                  <dt className="mt-1 font-mono text-[0.7rem] tracking-wider text-mist/80 uppercase">{stat.label}</dt>
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
      <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <Reveal>
          <GalaxySection
            heading="Every indexed chunk, in one space"
            intro="Each piece of code, commit, and pull request becomes a list of numbers that captures its meaning. This is that space, flattened to three dimensions — the same one your question lands in."
          />
        </Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Why trust the answers</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-chalk sm:text-4xl">
            Every answer shows its work
          </h2>
          <p className="mt-4 leading-relaxed text-mist">
            AI chat about code sounds equally confident whether or not it's right. Here you can check each statement against
            the code it came from, in one click.
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
      <section className="relative border-y border-white/5 bg-deep/50">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Repositories</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-chalk sm:text-4xl">
                Well-known libraries, ready to question
              </h2>
              <p className="mt-4 text-mist">From form handling to build tooling, each indexed from its real source.</p>
            </div>
            <Link to="/repos" className="font-semibold text-glow transition-colors hover:text-chalk">
              View all <span aria-hidden="true">→</span>
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

      {/* Call to action */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <Reveal>
          <div className="glass relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
            <span aria-hidden="true" className="absolute inset-x-0 -top-32 h-64 bg-linear-to-b from-iris/30 to-transparent blur-3xl" />
            <h2 className="relative font-display text-3xl font-semibold tracking-tight text-balance text-chalk sm:text-4xl">
              Pick a repository and start asking
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-mist">
              Ask how something works, why it changed, or where it lives, then follow the citations straight into the code.
            </p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <Link
                to={`/ask/${startRepo}`}
                className="rounded-xl bg-linear-to-r from-glow to-iris px-6 py-3.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
              >
                Start asking
              </Link>
              <Link
                to="/repos"
                className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-chalk transition-colors hover:bg-white/5"
              >
                Browse repositories
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
