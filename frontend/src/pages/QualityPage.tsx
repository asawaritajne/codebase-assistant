import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError, fetchQuality } from "../api";
import { LoadError } from "../components/LoadError";
import { Reveal } from "../components/Reveal";
import { formatNumber } from "../lib/format";
import { repoColor } from "../lib/repoColors";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { QualityMetrics } from "../types";

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const percent = (value: number) => `${value}%`;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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

/** A proportion drawn as one bar, in the colour of what it measures. */
function Meter({ value, tone = "bg-glow" }: { value: number; tone?: string }) {
  return (
    <span aria-hidden="true" className="mt-2 block h-px w-full bg-white/10">
      <span className={`block h-px ${tone}`} style={{ width: `${Math.max(value, 1)}%` }} />
    </span>
  );
}

function Verdict({ rating }: { rating: "up" | "down" | null }) {
  if (!rating) return <span className="font-mono text-xs text-mist/30">—</span>;
  return (
    <span className={`font-mono text-xs ${rating === "up" ? "text-emerald-300" : "text-ember"}`}>
      {rating === "up" ? "useful" : "missed"}
    </span>
  );
}

/** Daily volume as a row of columns; the flagged share sits at the foot of each column. */
function DailyVolume({ daily }: { daily: QualityMetrics["daily"] }) {
  const recent = daily.slice(-30);
  const peak = Math.max(...recent.map((entry) => entry.answers), 1);

  return (
    <div>
      <div className="flex h-28 items-end gap-1" role="img" aria-label={`Questions answered on each of the last ${recent.length} active days`}>
        {recent.map((entry) => (
          <span
            key={entry.date}
            title={`${day(entry.date)}: ${entry.answers} answered, ${entry.flagged} flagged`}
            className="group relative flex min-w-1.5 flex-1 flex-col justify-end"
            style={{ height: `${(entry.answers / peak) * 100}%` }}
          >
            <span className="block flex-1 bg-linear-to-t from-iris/70 to-glow/50 transition-colors group-hover:from-glow group-hover:to-glow" />
            {entry.flagged > 0 && (
              <span className="block bg-ember" style={{ height: `${(entry.flagged / entry.answers) * 100}%` }} />
            )}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[0.7rem] text-mist/60">
        <span>{recent[0] && day(recent[0].date)}</span>
        <span>{recent.at(-1) && day(recent.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

function Dashboard({ metrics }: { metrics: QualityMetrics }) {
  const { citations, regeneration, sources, latency, feedback } = metrics;

  return (
    <>
      <Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <Figure value={percent(citations.passRate)} label="citation pass rate" note={`${citations.flagged} flagged`} />
          <Figure value={formatNumber(metrics.answers)} label="answers recorded" />
          <Figure value={seconds(latency.medianMs)} label="median answer" note={`${seconds(latency.p95Ms)} at p95`} />
          <Figure
            value={feedback.rated === 0 ? "—" : percent(feedback.helpfulRate)}
            label="rated useful"
            note={feedback.rated === 0 ? "no ratings yet" : `${feedback.rated} ratings`}
          />
        </div>
      </Reveal>

      <Reveal className="mt-20">
        <h2 className="display text-3xl text-chalk">Citation discipline</h2>
        <p className="mt-3 max-w-2xl text-mist">
          Every answer is checked before it is shown. These are the results of that check, not a claim about it.
        </p>
        <dl className="mt-10 grid gap-x-12 gap-y-8 border-t border-white/10 pt-8 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs tracking-wider text-mist/80 uppercase">Traceable answers</dt>
            <dd className="mt-2 display text-2xl text-chalk tabular-nums">
              {citations.passed} <span className="text-mist/40">/ {metrics.answers}</span>
            </dd>
            <Meter value={citations.passRate} tone="bg-emerald-300" />
            <p className="mt-2 text-xs leading-relaxed text-mist/70">
              Cited only sources that exist, with every statement attributed.
            </p>
          </div>
          <div>
            <dt className="font-mono text-xs tracking-wider text-mist/80 uppercase">Rewritten automatically</dt>
            <dd className="mt-2 display text-2xl text-chalk tabular-nums">
              {regeneration.count} <span className="text-mist/40">· {percent(regeneration.rate)}</span>
            </dd>
            <Meter value={regeneration.rate} tone="bg-amber-300" />
            <p className="mt-2 text-xs leading-relaxed text-mist/70">
              Failed the first check and were generated again with the problem spelled out.
            </p>
          </div>
          <div>
            <dt className="font-mono text-xs tracking-wider text-mist/80 uppercase">Retrieved sources used</dt>
            <dd className="mt-2 display text-2xl text-chalk tabular-nums">{percent(sources.citedRate)}</dd>
            <Meter value={sources.citedRate} />
            <p className="mt-2 text-xs leading-relaxed text-mist/70">
              {formatNumber(sources.cited)} of {formatNumber(sources.retrieved)} retrieved chunks were actually cited;
              the rest were retrieved but not needed.
            </p>
          </div>
        </dl>
      </Reveal>

      {metrics.daily.length > 1 && (
        <Reveal className="mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="display text-3xl text-chalk">Questions over time</h2>
            <p className="font-mono text-xs text-mist/60">
              <span className="text-ember">red</span> = an answer whose citations were flagged
            </p>
          </div>
          <div className="mt-8 border-t border-white/10 pt-8">
            <DailyVolume daily={metrics.daily} />
          </div>
        </Reveal>
      )}

      {metrics.repos.length > 0 && (
        <Reveal className="mt-20">
          <h2 className="display text-3xl text-chalk">Per repository</h2>
          <p className="mt-3 max-w-2xl text-mist">
            Which codebases answer well, and which need more of their history indexed.
          </p>
          <div className="mt-8 border-t border-white/10">
            {metrics.repos.map((repo, index) => (
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
                <span className="col-span-2 flex items-baseline gap-4 md:col-span-5">
                  <span className="font-mono text-xs text-mist/50 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <span className="display text-xl text-chalk transition-colors group-hover:text-glow">{repo.repo}</span>
                </span>
                <span className="font-mono text-xs text-mist/80 md:col-span-2">
                  {repo.answers} {repo.answers === 1 ? "answer" : "answers"}
                </span>
                <span className="font-mono text-xs text-mist/80 md:col-span-2">
                  {percent(repo.passRate)} cited
                  <Meter value={repo.passRate} tone={repo.passRate === 100 ? "bg-emerald-300" : "bg-amber-300"} />
                </span>
                <span className="font-mono text-xs text-mist/80 md:col-span-2">{seconds(repo.medianMs)} median</span>
                <span className="font-mono text-xs md:col-span-1 md:text-right">
                  {repo.up > 0 && <span className="text-emerald-300">+{repo.up}</span>}
                  {repo.up > 0 && repo.down > 0 && <span className="text-mist/40"> / </span>}
                  {repo.down > 0 && <span className="text-ember">−{repo.down}</span>}
                  {repo.up === 0 && repo.down === 0 && <span className="text-mist/30">—</span>}
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal className="mt-20">
        <h2 className="display text-3xl text-chalk">The last questions asked</h2>
        <p className="mt-3 max-w-2xl text-mist">
          Real questions from this site, each one openable with the sources it was answered from.
        </p>
        <div className="mt-8 border-t border-white/10">
          {metrics.recent.map((answer) => (
            <Link
              key={answer.id}
              to={`/a/${answer.id}`}
              className="row-entry group grid grid-cols-1 items-baseline gap-x-6 gap-y-1 px-4 py-4 md:grid-cols-12 md:px-6"
            >
              <span className="col-span-full text-sm text-chalk transition-colors group-hover:text-glow md:col-span-6">
                {answer.question}
              </span>
              <span className="font-mono text-xs text-mist/70 md:col-span-2">
                {answer.repo.split("/").pop() || "—"}
              </span>
              <span className="font-mono text-xs text-mist/70 md:col-span-2">
                {seconds(answer.latencyMs)}
                {answer.regenerated && <span className="text-amber-200/80"> · rewritten</span>}
                {!answer.valid && <span className="text-ember"> · flagged</span>}
              </span>
              <span className="md:col-span-2 md:text-right">
                <Verdict rating={answer.rating} />
              </span>
            </Link>
          ))}
        </div>
      </Reveal>

      {metrics.models.length > 0 && (
        <Reveal className="mt-20">
          <h2 className="display text-3xl text-chalk">Which model answered</h2>
          <p className="mt-3 max-w-2xl text-mist">
            The free tier is often overloaded, so generation falls back down this list rather than failing the question.
          </p>
          <dl className="mt-8 space-y-5 border-t border-white/10 pt-8">
            {metrics.models.map((entry) => (
              <div key={entry.model}>
                <div className="flex items-baseline justify-between gap-4 font-mono text-xs">
                  <dt className="text-chalk">{entry.model}</dt>
                  <dd className="text-mist/70 tabular-nums">
                    {entry.answers} · {Math.round((entry.answers / metrics.answers) * 100)}%
                  </dd>
                </div>
                <Meter value={(entry.answers / metrics.answers) * 100} tone="bg-iris" />
              </div>
            ))}
          </dl>
        </Reveal>
      )}
    </>
  );
}

export function QualityPage() {
  useDocumentTitle("Answer quality");
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchQuality()
      .then(setMetrics)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "The quality figures couldn't be loaded."),
      );
  };

  useEffect(load, []);

  const range =
    metrics?.since && metrics.until
      ? `${new Date(metrics.since).toLocaleDateString()} – ${new Date(metrics.until).toLocaleDateString()}`
      : null;

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/5">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40 mask-[radial-gradient(70%_70%_at_30%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Answer quality</p>
            <h1 className="mt-3 max-w-3xl display text-4xl text-balance text-chalk sm:text-5xl">
              Measured, not <span className="text-aurora">asserted</span>
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-mist">
              Every answer this site has produced is checked for citations, timed, and kept. This page is that record —
              including the answers that failed. {range && <span className="font-mono text-sm text-mist/70">{range}</span>}
            </p>
          </Reveal>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {error ? (
          <LoadError message={error} onRetry={load} />
        ) : !metrics ? (
          <p role="status" className="py-16 text-sm text-mist">
            Reading the record…
          </p>
        ) : metrics.answers === 0 ? (
          <div className="border-t border-white/10 py-16">
            <h2 className="display text-2xl text-chalk">Nothing measured yet</h2>
            <p className="mt-3 max-w-xl text-mist">
              No questions have been answered on this instance, so there is nothing to report. Ask one and it will appear
              here, citation check and all.
            </p>
            <Link to="/repos" className="mt-6 inline-block font-semibold text-glow transition-colors hover:text-chalk">
              Pick a repository <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <Dashboard metrics={metrics} />
        )}
      </section>
    </div>
  );
}
