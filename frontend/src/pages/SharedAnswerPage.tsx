import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, fetchSharedAnswer } from "../api";
import { AnswerCard } from "../components/AnswerCard";
import { RepoMark } from "../components/repos/RepoMark";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";
import type { SharedAnswer } from "../types";

/** A permanent page for one answer, so it can be linked to with its sources intact. */
export function SharedAnswerPage() {
  const { id = "" } = useParams();
  const { repos } = useRepos();
  const [answer, setAnswer] = useState<SharedAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(answer ? answer.question.slice(0, 60) : "Shared answer");

  useEffect(() => {
    let cancelled = false;
    setAnswer(null);
    setError(null);
    fetchSharedAnswer(id)
      .then((loaded) => !cancelled && setAnswer(loaded))
      .catch((err: unknown) =>
        !cancelled && setError(err instanceof ApiError ? err.message : "That answer couldn't be loaded."),
      );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const repo = repos?.find((candidate) => candidate.id === answer?.repoId);

  return (
    <div className="relative">
      <div aria-hidden="true" className="bg-grid absolute inset-x-0 top-0 h-72 opacity-40 mask-[linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        {error ? (
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold text-chalk">Answer not found</h1>
            <p className="mt-3 text-mist">{error}</p>
            <Link to="/repos" className="mt-6 inline-block text-sm font-semibold text-glow hover:text-chalk">
              Browse repositories <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : !answer ? (
          <p role="status" className="py-24 text-center text-sm text-mist">
            Loading the answer…
          </p>
        ) : (
          <>
            <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">Shared answer</p>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-balance text-chalk sm:text-3xl">
              {answer.question}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-mist">
              {repo && <RepoMark repoId={repo.id} name={repo.name} size="sm" />}
              <span className="font-mono">{answer.repo}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={answer.createdAt}>{new Date(answer.createdAt).toLocaleDateString()}</time>
            </div>

            <div className="mt-8">
              <AnswerCard response={{ ...answer, shareId: null }} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={`/ask/${answer.repoId}`}
                className="rounded-xl bg-linear-to-r from-glow to-iris px-5 py-3 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
              >
                Ask your own question
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-chalk transition-colors hover:bg-white/5"
              >
                How answers are made
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
