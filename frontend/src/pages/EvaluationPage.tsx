import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError, fetchEvaluation, fetchQuality } from "../api";
import { LoadError } from "../components/LoadError";
import { Reveal } from "../components/Reveal";
import { repoColor } from "../lib/repoColors";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { EvalCaseResult, EvalRun, EvalScore, QualityMetrics } from "../types";

const percent = (value: number) => `${value}%`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

/** A headline number: serif numeral, monospace label, hairline rules between. */
function Figure({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="border-t border-white/10 px-1 py-6 first:border-glow/40 sm:border-t-0 sm:border-l sm:first:border-l-0 sm:px-6 sm:first:pl-0">
      <p className="display text-5xl text-chalk tabular-nums">{value}</p>
      <p className="mt-2 font-mono text-[0.7rem] tracking-wider text-mist/80 uppercase">{label}</p>
      {note && <p className="mt-1 text-xs text-mist/60">{note}</p>}
    </div>
  );
}

function Meter({ value, tone = "bg-glow" }: { value: number; tone?: string }) {
  return (
    <span aria-hidden="true" className="mt-2 block h-px w-full bg-white/10">
      <span className={`block h-px ${tone}`} style={{ width: `${Math.max(value, 1)}%` }} />
    </span>
  );
}

/** Where the expected file landed: first is a clean win, nothing at all is a miss. */
function Rank({ rank, skipped }: { rank: number | null; skipped?: string }) {
  if (skipped) return <span className="font-mono text-xs text-mist/40">skipped</span>;
  if (rank === null) return <span className="font-mono text-xs font-semibold text-ember">missed</span>;
  const tone = rank === 1 ? "text-emerald-300" : rank <= 3 ? "text-glow" : "text-amber-200";
  return <span className={`font-mono text-xs font-semibold ${tone}`}>#{rank}</span>;
}

/**
 * One benchmark case. The question and the file it should find sit side by side; when something
 * else came first, that file is named too — a miss should be legible, not just counted.
 */
function CaseRow({ result }: { result: EvalCaseResult }) {
  const first = result.retrieved[0];
  const beaten = result.rank !== 1 && first && !result.expect.includes(first.title) ? first : null;

  return (
    <div className="row-entry group relative grid grid-cols-1 items-baseline gap-x-6 gap-y-2 px-4 py-5 md:grid-cols-12 md:px-6">
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-0 w-px transition-all duration-200 group-hover:w-1"
        style={{ background: repoColor(result.repoId) }}
      />
      <span className="col-span-full md:col-span-5">
        <span className="block text-sm text-chalk">{result.question}</span>
        <span className="mt-1 block text-xs leading-relaxed text-mist/60">{result.because}</span>
      </span>

      <span className="col-span-full font-mono text-xs md:col-span-4">
        {result.expect.map((path) => (
          <span key={path} className="block truncate text-mist/80">
            {path}
          </span>
        ))}
        {beaten && (
          <span className="mt-1 block truncate text-ember/80" title={`Retrieved first instead: ${beaten.title}`}>
            beaten by {beaten.title}
          </span>
        )}
      </span>

      <span className="font-mono text-xs text-mist/60 md:col-span-2">
        {result.retrieved[0] ? `${(result.retrieved[0].score * 100).toFixed(1)} top score` : "—"}
      </span>
      <span className="md:col-span-1 md:text-right">
        <Rank rank={result.rank} skipped={result.skipped} />
      </span>
    </div>
  );
}

/**
 * A run made before the non-test floor existed measures the old behaviour, so say so rather than
 * letting its numbers stand for what retrieval does today.
 */
function StaleNotice({ run }: { run: EvalRun }) {
  if (run.policy === "non-test-floor") return null;
  return (
    <Reveal className="mt-10">
      <div className="border-l-2 border-amber-300/60 py-3 pl-5">
        <p className="text-sm leading-relaxed text-amber-100/90">
          These numbers measure the plain vector search, which is what produced them. They are the reason retrieval now
          reserves slots for non-test code — a change made after this run, and not yet benchmarked, because the day's
          free embedding quota was spent. The next run measures both and shows the difference here.
        </p>
      </div>
    </Reveal>
  );
}

/** The before-and-after that the benchmark produced, when a run measured both policies. */
function PolicyComparison({ run }: { run: EvalRun }) {
  const { overall, overallBaseline: baseline } = run;
  if (!baseline) return null;

  const rows: { label: string; before: string; after: string; improved: boolean }[] = [
    { label: "found first", before: percent(baseline.hitAt1), after: percent(overall.hitAt1), improved: overall.hitAt1 > baseline.hitAt1 },
    { label: "found in top 3", before: percent(baseline.hitAt3), after: percent(overall.hitAt3), improved: overall.hitAt3 > baseline.hitAt3 },
    { label: "found at all", before: percent(baseline.hitAt5), after: percent(overall.hitAt5), improved: overall.hitAt5 > baseline.hitAt5 },
    { label: "never found", before: String(baseline.misses), after: String(overall.misses), improved: overall.misses < baseline.misses },
  ];

  return (
    <Reveal className="mt-20">
      <h2 className="display text-3xl text-chalk">What the benchmark changed</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-mist">
        The first run failed four questions outright, and every one of them retrieved nothing but test files — a test
        named <span className="font-mono text-sm text-chalk">persistSync.test.tsx</span> looks a lot like the question
        “how does persist work?”, so it outranks the implementation it is testing. Retrieval now reserves three of its
        five slots for non-test code. Same questions, same embeddings, same index:
      </p>
      <dl className="mt-10 grid gap-x-12 gap-y-6 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="font-mono text-xs tracking-wider text-mist/80 uppercase">{row.label}</dt>
            <dd className="mt-2 flex items-baseline gap-3">
              <span className="display text-2xl text-mist/40 line-through tabular-nums">{row.before}</span>
              <span aria-hidden="true" className="text-mist/40">
                →
              </span>
              <span className={`display text-3xl tabular-nums ${row.improved ? "text-emerald-300" : "text-chalk"}`}>
                {row.after}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

function RepoScores({ repos }: { repos: EvalRun["repos"] }) {
  return (
    <div className="mt-8 border-t border-white/10">
      {repos.map((repo) => (
        <Link
          key={repo.repoId}
          to={`/ask/${repo.repoId}`}
          className="row-entry group relative grid grid-cols-2 items-baseline gap-x-6 gap-y-2 px-4 py-5 md:grid-cols-12 md:px-6"
        >
          <span
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-0 w-px transition-all duration-200 group-hover:w-1"
            style={{ background: repoColor(repo.repoId) }}
          />
          <span className="col-span-2 display text-xl text-chalk transition-colors group-hover:text-glow md:col-span-5">
            {repo.repo}
          </span>
          <span className="font-mono text-xs text-mist/80 md:col-span-2">{repo.cases} questions</span>
          <span className="font-mono text-xs text-mist/80 md:col-span-3">
            {percent(repo.hitAt5)} found
            <Meter value={repo.hitAt5} tone={repo.hitAt5 === 100 ? "bg-emerald-300" : "bg-amber-300"} />
          </span>
          <span className="font-mono text-xs text-mist/80 md:col-span-2 md:text-right">MRR {repo.mrr.toFixed(2)}</span>
        </Link>
      ))}
    </div>
  );
}

/** The record from real questions, kept deliberately small: it measures traffic, not correctness. */
function ProductionRecord({ metrics }: { metrics: QualityMetrics }) {
  if (metrics.answers === 0) return null;
  const { citations, regeneration, latency, feedback } = metrics;

  return (
    <Reveal className="mt-20">
      <h2 className="display text-3xl text-chalk">In production</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-mist">
        The benchmark measures retrieval. This is what the pipeline has actually done on real questions since it went
        up — a smaller sample, and one the system grades itself on, so read it as a log rather than a score.
      </p>
      <dl className="mt-8 grid grid-cols-2 gap-x-12 gap-y-6 border-t border-white/10 pt-8 sm:grid-cols-4">
        {[
          { label: "answers", value: String(metrics.answers) },
          { label: "citations passed", value: percent(citations.passRate), note: `${citations.flagged} flagged` },
          { label: "median answer", value: seconds(latency.medianMs), note: `${seconds(latency.p95Ms)} at p95` },
          {
            label: "rated useful",
            value: feedback.rated === 0 ? "—" : percent(feedback.helpfulRate),
            note: feedback.rated === 0 ? "no ratings yet" : `${feedback.rated} ratings`,
          },
        ].map((entry) => (
          <div key={entry.label}>
            <dt className="font-mono text-xs tracking-wider text-mist/80 uppercase">{entry.label}</dt>
            <dd className="mt-2 display text-2xl text-chalk tabular-nums">{entry.value}</dd>
            {entry.note && <p className="mt-1 text-xs text-mist/60">{entry.note}</p>}
          </div>
        ))}
      </dl>
      {regeneration.count > 0 && (
        <p className="mt-6 text-sm text-mist">
          {regeneration.count} {regeneration.count === 1 ? "answer was" : "answers were"} rewritten automatically after
          failing the citation check.
        </p>
      )}
      {metrics.recent.length > 0 && (
        <div className="mt-10">
          <h3 className="font-mono text-xs tracking-wider text-mist/80 uppercase">The last questions asked</h3>
          <div className="mt-4 border-t border-white/10">
            {metrics.recent.slice(0, 6).map((answer) => (
              <Link
                key={answer.id}
                to={`/a/${answer.id}`}
                className="row-entry group grid grid-cols-1 items-baseline gap-x-6 gap-y-1 px-4 py-3 md:grid-cols-12 md:px-6"
              >
                <span className="col-span-full text-sm text-chalk transition-colors group-hover:text-glow md:col-span-8">
                  {answer.question}
                </span>
                <span className="font-mono text-xs text-mist/70 md:col-span-2">
                  {answer.repo.split("/").pop() || "—"}
                </span>
                <span className="font-mono text-xs text-mist/70 md:col-span-2 md:text-right">
                  {seconds(answer.latencyMs)}
                  {!answer.valid && <span className="text-ember"> · flagged</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Reveal>
  );
}

function Scores({ run, totalCases }: { run: EvalRun; totalCases: number }) {
  const { overall } = run;
  const judged: EvalScore = overall;
  const skipped = run.results.filter((result) => result.skipped).length;

  return (
    <>
      <Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <Figure
            value={percent(judged.hitAt1)}
            label="found first"
            note="the right file ranked #1"
          />
          <Figure value={percent(judged.hitAt5)} label="found at all" note={`${judged.misses} never found`} />
          <Figure value={judged.mrr.toFixed(2)} label="mean reciprocal rank" note="1.00 would be perfect" />
          <Figure
            value={String(judged.cases)}
            label="questions judged"
            note={skipped > 0 ? `${skipped} skipped · ${totalCases} written` : `${totalCases} written by hand`}
          />
        </div>
      </Reveal>

      <StaleNotice run={run} />
      <PolicyComparison run={run} />

      <Reveal className="mt-20">
        <h2 className="display text-3xl text-chalk">Per repository</h2>
        <p className="mt-3 max-w-2xl text-mist">
          A repository whose code is thoroughly indexed answers better. This is where that shows.
        </p>
        <RepoScores repos={run.repos} />
      </Reveal>

      <Reveal className="mt-20">
        <h2 className="display text-3xl text-chalk">Every question, and how it did</h2>
        <p className="mt-3 max-w-2xl text-mist">
          The whole benchmark, misses included. Each row names the file that should have been found and, when something
          else came first, what beat it.
        </p>
        <div className="mt-8 border-t border-white/10">
          {run.results.map((result) => (
            <CaseRow key={result.id} result={result} />
          ))}
        </div>
      </Reveal>
    </>
  );
}

export function EvaluationPage() {
  useDocumentTitle("Evaluation");
  const [run, setRun] = useState<EvalRun | null>(null);
  const [totalCases, setTotalCases] = useState(0);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setLoaded(false);
    fetchEvaluation()
      .then((response) => {
        setRun(response.run);
        setTotalCases(response.totalCases);
        setLoaded(true);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "The benchmark results couldn't be loaded."),
      );
    // The production record is secondary; its absence shouldn't fail the page.
    fetchQuality()
      .then(setMetrics)
      .catch(() => setMetrics(null));
  };

  useEffect(load, []);

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/5">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40 mask-[radial-gradient(70%_70%_at_30%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Evaluation</p>
            <h1 className="mt-3 max-w-3xl display text-4xl text-balance text-chalk sm:text-5xl">
              Does it find the <span className="text-aurora">right file</span>?
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-mist">
              A benchmark of hand-written questions, each one naming — in advance — the file that genuinely answers it.
              Retrieval either finds that file or it doesn't. No language model takes part, so nothing here can be
              argued into being right after the fact.
            </p>
            {run && (
              <p className="mt-5 font-mono text-xs text-mist/70">
                last run {new Date(run.finishedAt).toLocaleString()} · judged on the top {run.limit} results ·{" "}
                {run.embeddingModel}
              </p>
            )}
          </Reveal>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {error ? (
          <LoadError message={error} onRetry={load} />
        ) : !loaded ? (
          <p role="status" className="py-16 text-sm text-mist">
            Reading the last run…
          </p>
        ) : !run ? (
          <div className="border-t border-white/10 py-16">
            <h2 className="display text-2xl text-chalk">The benchmark hasn't been run yet</h2>
            <p className="mt-3 max-w-xl text-mist">
              {totalCases} questions are written and waiting. Run <span className="font-mono text-sm">npm run eval</span>{" "}
              in the backend to produce a scoreboard.
            </p>
          </div>
        ) : (
          <>
            <Scores run={run} totalCases={totalCases} />
            {metrics && <ProductionRecord metrics={metrics} />}
          </>
        )}
      </section>
    </div>
  );
}
