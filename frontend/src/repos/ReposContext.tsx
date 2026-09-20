import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, fetchRepos } from "../api";
import type { RepoSummary } from "../types";

interface ReposState {
  /** Null until the first successful load. */
  repos: RepoSummary[] | null;
  error: string | null;
  reload: () => void;
}

const ReposContext = createContext<ReposState | null>(null);

/** Loads the repository catalog once and shares it across pages. */
export function ReposProvider({ children }: { children: ReactNode }) {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchRepos()
      .then((loaded) => {
        if (!cancelled) setRepos(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the repositories.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo(() => ({ repos, error, reload: () => setAttempt((n) => n + 1) }), [repos, error]);
  return <ReposContext value={value}>{children}</ReposContext>;
}

export function useRepos(): ReposState {
  const state = useContext(ReposContext);
  if (!state) throw new Error("useRepos must be used inside <ReposProvider>");
  return state;
}
