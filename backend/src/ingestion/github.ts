const API_BASE = "https://api.github.com";
const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_SECONDS = 120;
const LOW_QUOTA_THRESHOLD = 100;

export class GitHubRateLimitError extends Error {
  constructor(
    message: string,
    readonly resetAt: Date | null,
  ) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetAt: Date;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimited(res: Response, body: string): boolean {
  if (res.status === 429) return true;
  // 403 is also used for plain permission errors, so look for rate-limit signals.
  return (
    res.status === 403 &&
    (res.headers.get("x-ratelimit-remaining") === "0" ||
      res.headers.has("retry-after") ||
      /rate limit/i.test(body))
  );
}

/** fetch() reports every network failure as "fetch failed"; the useful detail is in `cause`. */
function describeNetworkError(error: unknown): string {
  if (error instanceof Error && error.cause instanceof Error) return error.cause.message;
  return error instanceof Error ? error.message : String(error);
}

export class GitHubClient {
  private warnedLowQuota = false;

  constructor(private readonly token: string) {}

  async get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(path, API_BASE);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt++) {
      // Dropped connections and GitHub 5xx responses are transient, so they get
      // a short exponential backoff before giving up.
      const backoffSeconds = 2 ** attempt;

      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "User-Agent": "codebase-assistant",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
      } catch (error) {
        const detail = describeNetworkError(error);
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Network error calling GitHub (GET ${url.pathname}): ${detail}`, { cause: error });
        }
        console.warn(`[github] Network error on GET ${url.pathname} (${detail}); retrying in ${backoffSeconds}s`);
        await sleep(backoffSeconds * 1000);
        continue;
      }

      if (res.ok) {
        this.warnIfQuotaLow(res.headers);
        return (await res.json()) as T;
      }

      const body = await res.text();
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(`[github] GitHub returned ${res.status} for GET ${url.pathname}; retrying in ${backoffSeconds}s`);
        await sleep(backoffSeconds * 1000);
        continue;
      }
      if (res.status === 401) {
        throw new Error("GitHub rejected GITHUB_TOKEN (401 Unauthorized). Check that it is valid and not expired.");
      }
      if (!isRateLimited(res, body)) {
        throw new Error(`GitHub API returned ${res.status} for GET ${url.pathname}: ${body.slice(0, 300)}`);
      }

      // Primary limit: the hourly quota is used up. Waiting could take up to an
      // hour, so stop and let the caller report when it resets.
      if (res.headers.get("x-ratelimit-remaining") === "0") {
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        const resetAt = reset ? new Date(reset * 1000) : null;
        throw new GitHubRateLimitError(
          `GitHub API rate limit exhausted; quota resets at ${resetAt?.toLocaleTimeString() ?? "an unknown time"}.`,
          resetAt,
        );
      }

      // Secondary limit: GitHub wants us to back off briefly, then retry.
      const waitSeconds = Number(res.headers.get("retry-after")) || 60;
      if (attempt >= MAX_RETRIES || waitSeconds > MAX_RETRY_WAIT_SECONDS) {
        throw new GitHubRateLimitError(
          `GitHub secondary rate limit on GET ${url.pathname} did not clear after ${attempt} retries.`,
          new Date(Date.now() + waitSeconds * 1000),
        );
      }
      console.warn(
        `[github] Secondary rate limit hit; waiting ${waitSeconds}s before retry ${attempt + 1}/${MAX_RETRIES}`,
      );
      await sleep(waitSeconds * 1000);
    }
  }

  /** Checking the quota does not itself count against it. */
  async getRateLimit(): Promise<RateLimitStatus> {
    const { resources } = await this.get<{
      resources: { core: { limit: number; remaining: number; reset: number } };
    }>("/rate_limit");
    const { limit, remaining, reset } = resources.core;
    return { limit, remaining, resetAt: new Date(reset * 1000) };
  }

  private warnIfQuotaLow(headers: Headers): void {
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    if (!this.warnedLowQuota && headers.has("x-ratelimit-remaining") && remaining < LOW_QUOTA_THRESHOLD) {
      this.warnedLowQuota = true;
      console.warn(`[github] Only ${remaining} API requests left in this rate-limit window`);
    }
  }
}
