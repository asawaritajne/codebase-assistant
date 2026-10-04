import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MongoNetworkError, MongoServerError, MongoServerSelectionError } from "mongodb";
import { withMongoRetry } from "./mongo.js";

const blip = () => new MongoNetworkError("connection 3 to cluster closed");
/** The driver needs a topology description it will never read here, so it is faked. */
const unreachable = () =>
  new MongoServerSelectionError("Server selection timed out after 10000 ms" as never, {
    servers: new Map(),
  } as never);

/** Fails `times` times, then succeeds — the shape of a transient outage. */
function flaky<T>(times: number, value: T, error: () => Error = blip) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    run: async () => {
      calls += 1;
      if (calls <= times) throw error();
      return value;
    },
  };
}

describe("withMongoRetry", () => {
  it("returns the value without retrying when the operation succeeds", async () => {
    const operation = flaky(0, "ok");
    assert.equal(await withMongoRetry("reading", operation.run), "ok");
    assert.equal(operation.calls, 1);
  });

  it("rethrows an error that retrying cannot fix, without waiting", async () => {
    // A duplicate key will fail identically every time; retrying only delays the report.
    const started = Date.now();
    await assert.rejects(
      () => withMongoRetry("writing", async () => Promise.reject(new MongoServerError({ message: "duplicate key" }))),
      /duplicate key/,
    );
    assert.ok(Date.now() - started < 500, "should not have slept before rethrowing");
  });

  it("gives up after the last attempt rather than retrying forever", async () => {
    const operation = flaky(99, "never");
    await assert.rejects(() => withMongoRetry("reading", operation.run, 1), /closed/);
    assert.equal(operation.calls, 1);
  });

  it("honours a lower attempt limit, as connecting does", async () => {
    const operation = flaky(99, "never", unreachable);
    await assert.rejects(() => withMongoRetry("connecting", operation.run, 2), /Server selection timed out/);
    assert.equal(operation.calls, 2);
  });

  it("recovers when a blip clears before the attempts run out", async () => {
    const operation = flaky(1, "connected");
    assert.equal(await withMongoRetry("connecting", operation.run, 3), "connected");
    assert.equal(operation.calls, 2);
  });

  it("treats an unreachable cluster as worth retrying", async () => {
    // This is what killed the benchmark step on 2026-10-04.
    const operation = flaky(1, "connected", unreachable);
    assert.equal(await withMongoRetry("connecting", operation.run, 3), "connected");
    assert.equal(operation.calls, 2);
  });
});
