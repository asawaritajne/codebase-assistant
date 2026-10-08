import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Compares two secrets without revealing, through how long the comparison took, how much of the
 * guess was right. Lengths are compared first because that much is unavoidable.
 */
function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guards the endpoints that cost real money or quota.
 *
 * With no token configured every request is refused rather than allowed: forgetting to set the
 * variable should take ingestion offline, not leave someone else's GitHub token free to spend.
 */
export function requireAdmin(adminToken: string | null): RequestHandler {
  return (req, res, next) => {
    if (!adminToken) {
      res.status(503).json({ error: "Ingestion is disabled: this deployment has no ADMIN_TOKEN set." });
      return;
    }

    const header = req.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!given || !matches(given, adminToken)) {
      res.status(401).json({ error: "This endpoint needs a valid admin token." });
      return;
    }

    next();
  };
}
