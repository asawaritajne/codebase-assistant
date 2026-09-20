import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { ApiError, askQuestion, type ApiErrorKind } from "../api";
import { AnswerCard } from "../components/AnswerCard";
import { Composer } from "../components/Composer";
import { ErrorCard } from "../components/ErrorCard";
import { LoadError } from "../components/LoadError";
import { LoadingAnswer } from "../components/LoadingAnswer";
import { RepoMark } from "../components/repos/RepoMark";
import { StatusBadge, statusLabel } from "../components/repos/StatusBadge";
import { formatNumber, indexedPercent } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";
import type { AskResponse, RepoSummary } from "../types";

type Turn =
  | { id: string; question: string; status: "loading"; startedAt: number }
  | { id: string; question: string; status: "done"; response: AskResponse }
  | { id: string; question: string; status: "error"; error: { kind: ApiErrorKind; message: string } };

const turnElementId = (id: string) => `turn-${id}`;

function describeError(error: unknown): { kind: ApiErrorKind; message: string } {
  if (error instanceof ApiError) return { kind: error.kind, message: error.message };
  return { kind: "server", message: "Something unexpected went wrong. Please try again." };
}

function RepoSidebar({ repos }: { repos: RepoSummary[] }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 lg:flex">
      <p className="px-5 pt-5 pb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Repositories</p>
      <nav aria-label="Repositories" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {repos.map((repo) => (
          <NavLink
            key={repo.id}
            to={`/ask/${repo.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                isActive ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/70"
              }`
            }
          >
            <RepoMark repoId={repo.id} name={repo.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-900">{repo.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {repo.status === "ready" ? repo.category : statusLabel(repo)}
              </span>
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4 text-xs">
        <Link to="/how-it-works" className="font-medium text-slate-600 hover:text-slate-900">
          How answers are made <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}

function ChatHeader({ repo, repos, onSwitch }: { repo: RepoSummary; repos: RepoSummary[]; onSwitch: (id: string) => void }) {
  const { stats } = repo;
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <RepoMark repoId={repo.id} name={repo.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-semibold text-slate-900">{repo.name}</h1>
            <StatusBadge repo={repo} />
          </div>
          <p className="truncate text-xs text-slate-500">
            {formatNumber(stats.files)} files · {formatNumber(stats.commits)} commits · {formatNumber(stats.pullRequests)} pull
            requests indexed
          </p>
        </div>
        <a
          href={repo.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <label className="w-full lg:hidden">
          <span className="sr-only">Switch repository</span>
          <select
            value={repo.id}
            onChange={(event) => onSwitch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {repos.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status === "ready" ? "" : ` (${statusLabel(option)})`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {repo.status === "indexing" && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          Still indexing: {indexedPercent(repo)}% of this repository is searchable so far, so answers may miss parts that
          aren't indexed yet.
        </p>
      )}
    </div>
  );
}

function RepoEmptyState({
  repo,
  canAsk,
  busy,
  onPick,
}: {
  repo: RepoSummary;
  canAsk: boolean;
  busy: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <div className="py-8 text-center sm:py-12">
      <div className="flex justify-center">
        <RepoMark repoId={repo.id} name={repo.name} size="lg" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-900">Ask about {repo.name}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
        {repo.description} Answers come only from its indexed code, tests, commits, and pull requests, with every claim linked
        to GitHub.
      </p>
      {canAsk && (
        <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
          {repo.exampleQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={busy}
              onClick={() => onPick(question)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AskPage() {
  const { repoId = "" } = useParams();
  const navigate = useNavigate();
  const { repos, error, reload } = useRepos();
  /** One conversation per repository, kept while switching between them. */
  const [conversations, setConversations] = useState<Record<string, Turn[]>>({});
  /** The turn just asked or retried; the view follows it. */
  const [activeTurnId, setActiveTurnId] = useState<string>();

  const repo = repos?.find((candidate) => candidate.id === repoId);
  const turns = conversations[repoId] ?? [];
  // One question at a time across all repos keeps within the free-tier rate limits.
  const busy = Object.values(conversations).some((list) => list.some((turn) => turn.status === "loading"));

  useDocumentTitle(repo ? `Ask ${repo.name}` : "Ask");

  // Bring the active turn's question to the top of the view, both when it's sent and when its
  // answer arrives, so a long answer is read from its first line rather than its last.
  useEffect(() => {
    if (activeTurnId) {
      document.getElementById(turnElementId(activeTurnId))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [conversations, activeTurnId]);

  const updateTurns = (key: string, update: (list: Turn[]) => Turn[]) =>
    setConversations((current) => ({ ...current, [key]: update(current[key] ?? []) }));

  const replaceTurn = (key: string, next: Turn) =>
    updateTurns(key, (list) => list.map((turn) => (turn.id === next.id ? next : turn)));

  const run = async (key: string, id: string, question: string) => {
    try {
      replaceTurn(key, { id, question, status: "done", response: await askQuestion(key, question) });
    } catch (err) {
      replaceTurn(key, { id, question, status: "error", error: describeError(err) });
    }
  };

  const ask = (question: string) => {
    const id = crypto.randomUUID();
    updateTurns(repoId, (list) => [...list, { id, question, status: "loading", startedAt: Date.now() }]);
    setActiveTurnId(id);
    void run(repoId, id, question);
  };

  const retry = (turn: Turn) => {
    replaceTurn(repoId, { id: turn.id, question: turn.question, status: "loading", startedAt: Date.now() });
    setActiveTurnId(turn.id);
    void run(repoId, turn.id, turn.question);
  };

  if (error) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  if (!repos) {
    return (
      <div role="status" className="flex flex-1 items-center justify-center py-24 text-sm text-slate-500">
        Loading repositories…
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Repository not found</h1>
        <p className="mt-3 text-slate-600">There's no repository called “{repoId}” here.</p>
        <Link to="/repos" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Browse repositories <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const canAsk = repo.stats.chunks > 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)]">
      <RepoSidebar repos={repos} />
      <section aria-label={`Ask about ${repo.name}`} className="flex min-w-0 flex-1 flex-col">
        <ChatHeader repo={repo} repos={repos} onSwitch={(id) => navigate(`/ask/${id}`)} />

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="mx-auto max-w-3xl px-4 py-6" role="log" aria-live="polite" aria-label="Conversation">
            {turns.length === 0 ? (
              <RepoEmptyState repo={repo} canAsk={canAsk} busy={busy} onPick={ask} />
            ) : (
              <ol className="space-y-8">
                {turns.map((turn) => (
                  <li key={turn.id} id={turnElementId(turn.id)} className="scroll-mt-4 space-y-3">
                    <div className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
                        {turn.question}
                      </p>
                    </div>
                    {turn.status === "loading" && <LoadingAnswer startedAt={turn.startedAt} />}
                    {turn.status === "error" && (
                      <ErrorCard kind={turn.error.kind} message={turn.error.message} onRetry={busy ? undefined : () => retry(turn)} />
                    )}
                    {turn.status === "done" && <AnswerCard response={turn.response} />}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {canAsk ? (
              <Composer onSubmit={ask} busy={busy} placeholder={`Ask about ${repo.name}…`} />
            ) : (
              <p className="py-3 text-center text-sm text-slate-500">
                {repo.name} isn't searchable yet. It will open up for questions as soon as its indexing starts.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
