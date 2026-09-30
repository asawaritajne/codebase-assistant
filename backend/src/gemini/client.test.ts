import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BATCH_TIMEOUT_RETRIES, planRetry, withDeadline } from "./client.js";

describe("withDeadline", () => {
  it("returns the value when the call answers in time", async () => {
    assert.equal(await withDeadline("embedding", async () => "vectors", 1000), "vectors");
  });

  it("passes a signal the call can watch", async () => {
    const signal = await withDeadline("embedding", async (abortSignal) => abortSignal, 1000);
    assert.equal(signal.aborted, false);
  });

  it("aborts the signal once the deadline passes", async () => {
    const aborted = await withDeadline(
      "embedding",
      (abortSignal) =>
        new Promise<boolean>((resolve) => abortSignal.addEventListener("abort", () => resolve(true))),
      20,
    );
    assert.equal(aborted, true);
  });

  it("gives up on a call that ignores the signal entirely", async () => {
    // This is the failure that wedged the overnight run: a promise that never settles.
    await assert.rejects(
      () => withDeadline("embedding", () => new Promise(() => {}), 20),
      (error: Error) => {
        assert.equal(error.name, "AbortError");
        assert.match(error.message, /went unanswered/);
        return true;
      },
    );
  });

  it("surfaces the call's own error rather than the deadline's", async () => {
    await assert.rejects(
      () => withDeadline("embedding", async () => Promise.reject(new Error("rate limited")), 1000),
      /rate limited/,
    );
  });

  it("leaves no timer keeping the process alive", async () => {
    const before = process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
    await withDeadline("embedding", async () => "done", 60_000);
    const after = process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
    assert.equal(after, before);
  });
});

describe("planRetry with a deadline error", () => {
  const timeout = Object.assign(new Error("Gemini embedding request went unanswered for 45s"), {
    name: "AbortError",
  });

  it("retries a timeout once, then gives up rather than keeping a reader waiting", () => {
    const plan = planRetry(timeout, 0, "generation");
    assert.ok(plan.waitSeconds > 0);

    assert.throws(() => planRetry(timeout, 1, "generation"), /timed out/);
  });

  it("lets a background run ride out several timeouts", () => {
    // A blip mid-run used to abandon the rest of the day's embedding quota.
    for (let retries = 0; retries < BATCH_TIMEOUT_RETRIES; retries++) {
      assert.ok(planRetry(timeout, retries, "embedding", { maxTimeoutRetries: BATCH_TIMEOUT_RETRIES }).waitSeconds > 0);
    }
  });

  it("still gives up on a run that is genuinely stuck", () => {
    assert.throws(
      () => planRetry(timeout, BATCH_TIMEOUT_RETRIES, "embedding", { maxTimeoutRetries: BATCH_TIMEOUT_RETRIES }),
      /timed out/,
    );
  });

  it("backs off further with each consecutive timeout", () => {
    const first = planRetry(timeout, 0, "embedding", { maxTimeoutRetries: BATCH_TIMEOUT_RETRIES }).waitSeconds;
    const later = planRetry(timeout, 3, "embedding", { maxTimeoutRetries: BATCH_TIMEOUT_RETRIES }).waitSeconds;
    assert.ok(later > first, `expected backoff to grow, got ${first} then ${later}`);
  });
});
