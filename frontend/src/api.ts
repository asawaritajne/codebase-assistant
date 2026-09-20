import type { AskResponse, RepoSummary } from "./types";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "");

/** Generous, because a free-tier backend that has gone to sleep can take a minute to wake up. */
const ASK_TIMEOUT_MS = 120_000;
const REPOS_TIMEOUT_MS = 70_000;

export type ApiErrorKind = "unreachable" | "rate-limited" | "timeout" | "invalid-question" | "server";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, signal: timeout });
  } catch {
    if (timeout.aborted) {
      throw new ApiError("timeout", "The server took too long to respond. Please try again.");
    }
    throw new ApiError("unreachable", `Couldn't reach the backend at ${API_URL}. Check that it's running and try again.`);
  }

  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (response.ok && body) return body;

  const serverMessage = typeof body?.error === "string" ? body.error : undefined;
  switch (response.status) {
    case 429:
      throw new ApiError(
        "rate-limited",
        "The AI service's free-tier limit has been reached. Wait a minute and try again; if the daily limit is used up, it resets tomorrow.",
      );
    case 400:
      throw new ApiError("invalid-question", serverMessage ?? "That request couldn't be processed.");
    default:
      throw new ApiError(
        "server",
        serverMessage
          ? `The server ran into a problem: ${serverMessage}`
          : `The server returned an error (HTTP ${response.status}).`,
      );
  }
}

export function askQuestion(repo: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(
    "/ask",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, question }) },
    ASK_TIMEOUT_MS,
  );
}

export async function fetchRepos(): Promise<RepoSummary[]> {
  return (await request<{ repos: RepoSummary[] }>("/repos", {}, REPOS_TIMEOUT_MS)).repos;
}
