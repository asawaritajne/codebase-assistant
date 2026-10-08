import type { RequestHandler } from "express";

/** Window the allowance refills over. */
const WINDOW_MS = 60 * 60 * 1000;
/** Questions one visitor may ask per window. */
const DEFAULT_LIMIT = 20;
/** Stop the map of callers growing without bound on a long-running server. */
const SWEEP_EVERY_MS = 10 * 60 * 1000;

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

interface Allowance {
  used: number;
  resetsAt: number;
}

/**
 * A small fixed-window limit per caller, held in memory.
 *
 * Answering a question costs an embedding and a generation from a free tier of roughly a thousand
 * a day, shared with indexing — so one visitor with a loop could take the site down for everyone
 * until midnight. In memory is the right size for this: one instance, and a limit that resets on
 * deploy is not worth a database round trip per question.
 */
export function rateLimit({ limit = DEFAULT_LIMIT, windowMs = WINDOW_MS }: RateLimitOptions = {}): RequestHandler {
  const callers = new Map<string, Allowance>();
  let lastSweep = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > SWEEP_EVERY_MS) {
      for (const [key, allowance] of callers) if (allowance.resetsAt <= now) callers.delete(key);
      lastSweep = now;
    }

    // Render terminates TLS in front of the app, so the real caller is in X-Forwarded-For.
    const key = (req.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || req.ip || "unknown";
    const current = callers.get(key);
    const allowance = current && current.resetsAt > now ? current : { used: 0, resetsAt: now + windowMs };

    if (allowance.used >= limit) {
      const seconds = Math.ceil((allowance.resetsAt - now) / 1000);
      res.set("Retry-After", String(seconds));
      res.status(429).json({
        error: `That's ${limit} questions in an hour, which is this free deployment's limit. Try again in ${Math.ceil(seconds / 60)} minutes.`,
      });
      return;
    }

    allowance.used += 1;
    callers.set(key, allowance);
    res.set("RateLimit-Remaining", String(limit - allowance.used));
    next();
  };
}
