import { ApiError, GoogleGenAI } from "@google/genai";

const MAX_RETRIES = 5;
const MAX_RETRY_WAIT_SECONDS = 120;
/**
 * Without a limit, a request Gemini never answers would hold an /ask call open long after the
 * browser gave up (the frontend waits 120s). Normal calls finish well inside this.
 */
const REQUEST_TIMEOUT_MS = 45_000;
/** A second timeout in a row means Gemini is struggling; fail rather than keep the caller waiting. */
const MAX_TIMEOUT_RETRIES = 1;

export class GeminiQuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaExhaustedError";
  }
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GoogleErrorBody {
  error?: {
    message?: string;
    details?: { retryDelay?: string; violations?: { quotaId?: string }[] }[];
  };
}

/** ApiError.message holds the JSON error body returned by the API. */
function parseErrorBody(error: ApiError): GoogleErrorBody {
  try {
    return JSON.parse(error.message) as GoogleErrorBody;
  } catch {
    return {};
  }
}

export interface RetryPlan {
  waitSeconds: number;
  /** True when the quota counts tokens, so the caller should send smaller requests. */
  isTokenQuota: boolean;
}

/**
 * Decides what to do with a failed Gemini call: returns how long to wait before retrying, throws
 * GeminiQuotaExhaustedError when the quota is spent (the caller should stop and resume later), or
 * rethrows anything that isn't worth retrying.
 */
export function planRetry(error: unknown, retries: number, label: string): RetryPlan {
  const backoffSeconds = Math.min(2 ** retries, 60);

  if (!(error instanceof ApiError)) {
    // The SDK enforces REQUEST_TIMEOUT_MS by aborting the fetch; nothing else aborts these calls.
    if (error instanceof Error && error.name === "AbortError") {
      if (retries >= MAX_TIMEOUT_RETRIES) {
        throw new Error(`Gemini ${label} request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, { cause: error });
      }
      console.warn(`[gemini] ${label}: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s; retrying in ${backoffSeconds}s`);
      return { waitSeconds: backoffSeconds, isTokenQuota: false };
    }
    // The SDK surfaces dropped connections as fetch's TypeError("fetch failed").
    if (error instanceof TypeError && retries < MAX_RETRIES) {
      const detail = error.cause instanceof Error ? error.cause.message : error.message;
      console.warn(`[gemini] ${label}: network error (${detail}); retrying in ${backoffSeconds}s`);
      return { waitSeconds: backoffSeconds, isTokenQuota: false };
    }
    throw error;
  }

  const body = parseErrorBody(error);
  const reason = (body.error?.message ?? error.message).slice(0, 300);
  if (error.status >= 500 && retries < MAX_RETRIES) {
    console.warn(`[gemini] ${label}: Gemini returned ${error.status}; retrying in ${backoffSeconds}s`);
    return { waitSeconds: backoffSeconds, isTokenQuota: false };
  }
  if (error.status !== 429) {
    throw new Error(`Gemini API returned ${error.status} for ${label}: ${reason}`, { cause: error });
  }

  const details = body.error?.details ?? [];
  const quotaIds = details.flatMap((detail) => detail.violations ?? []).map((violation) => violation.quotaId ?? "");
  const retryDelay = Math.ceil(Number.parseFloat(details.find((d) => d.retryDelay)?.retryDelay ?? "")) || 60;
  const limit = quotaIds.filter(Boolean).join(", ") || "unspecified quota";
  if (quotaIds.some((id) => /PerDay/i.test(id)) || retries >= MAX_RETRIES || retryDelay > MAX_RETRY_WAIT_SECONDS) {
    throw new GeminiQuotaExhaustedError(
      `Gemini ${label} quota exhausted (${limit}; retry after ${retryDelay}s, attempt ${retries + 1}): ${reason}`,
    );
  }

  console.warn(`[gemini] ${label}: rate limit hit (${limit}); waiting ${retryDelay}s`);
  return { waitSeconds: retryDelay, isTokenQuota: quotaIds.some((id) => /token/i.test(id)) };
}
