import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import { rateLimit } from "./rateLimit.js";

interface Result {
  allowed: boolean;
  status?: number;
  error?: string;
  headers: Record<string, string>;
}

/** Sends one request from `ip` through the limiter and reports what happened. */
function send(limiter: RequestHandler, ip: string, forwardedFor?: string): Result {
  const result: Result = { allowed: false, headers: {} };

  const req = {
    ip,
    get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? forwardedFor : undefined),
  } as Request;

  const res = {
    set(name: string, value: string) {
      result.headers[name] = value;
      return this;
    },
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: { error?: string }) {
      result.error = body.error;
      return this;
    },
  } as unknown as Response;

  limiter(req, res, () => void (result.allowed = true));
  return result;
}

describe("rateLimit", () => {
  it("allows requests up to the limit and refuses the next one", () => {
    const limiter = rateLimit({ limit: 3 });

    for (let attempt = 1; attempt <= 3; attempt++) {
      assert.equal(send(limiter, "1.1.1.1").allowed, true, `request ${attempt} should be allowed`);
    }

    const refused = send(limiter, "1.1.1.1");
    assert.equal(refused.allowed, false);
    assert.equal(refused.status, 429);
    assert.match(refused.error ?? "", /3 questions in an hour/);
  });

  it("counts each caller separately", () => {
    const limiter = rateLimit({ limit: 1 });

    assert.equal(send(limiter, "1.1.1.1").allowed, true);
    assert.equal(send(limiter, "1.1.1.1").allowed, false);
    // A different visitor is unaffected by the first one's spending.
    assert.equal(send(limiter, "2.2.2.2").allowed, true);
  });

  it("identifies the caller behind a proxy by the forwarded address", () => {
    // Render puts every request through one proxy, so req.ip is the same for everyone.
    const limiter = rateLimit({ limit: 1 });

    assert.equal(send(limiter, "10.0.0.1", "203.0.113.5").allowed, true);
    assert.equal(send(limiter, "10.0.0.1", "203.0.113.5").allowed, false);
    assert.equal(send(limiter, "10.0.0.1", "203.0.113.9").allowed, true);
  });

  it("takes only the original client from a chain of proxies", () => {
    const limiter = rateLimit({ limit: 1 });

    assert.equal(send(limiter, "10.0.0.1", "203.0.113.5, 70.41.3.18").allowed, true);
    assert.equal(send(limiter, "10.0.0.1", "203.0.113.5, 10.1.1.1").allowed, false);
  });

  it("allows requests again once the window has passed", () => {
    const limiter = rateLimit({ limit: 1, windowMs: 1 });
    assert.equal(send(limiter, "1.1.1.1").allowed, true);

    const start = Date.now();
    while (Date.now() === start) {
      /* wait for the clock to tick past the window */
    }

    assert.equal(send(limiter, "1.1.1.1").allowed, true);
  });

  it("tells the caller how much of their allowance is left", () => {
    const limiter = rateLimit({ limit: 2 });
    assert.equal(send(limiter, "1.1.1.1").headers["RateLimit-Remaining"], "1");
    assert.equal(send(limiter, "1.1.1.1").headers["RateLimit-Remaining"], "0");
  });

  it("tells a refused caller when to come back", () => {
    const limiter = rateLimit({ limit: 1 });
    send(limiter, "1.1.1.1");
    const refused = send(limiter, "1.1.1.1");
    assert.ok(Number(refused.headers["Retry-After"]) > 0);
  });
});
