import {
  MongoClient,
  MongoNetworkError,
  MongoOperationTimeoutError,
  MongoServerSelectionError,
  type Db,
} from "mongodb";

const MAX_ATTEMPTS = 4;
/**
 * Fewer tries for the first connection than for an operation. Each one already waits out
 * `CONNECT_TIMEOUT_MS`, and the other likely cause — this machine's IP missing from the Atlas
 * allowlist — is permanent, so the error should still arrive quickly rather than after a minute.
 */
const CONNECT_ATTEMPTS = 3;
/** Fail fast per attempt; the driver's own default is 30s. */
const CONNECT_TIMEOUT_MS = 10_000;
/**
 * Deadline for one database call, so a stalled one reports instead of hanging.
 *
 * withMongoRetry can only retry an operation that fails. A read against a socket that died quietly
 * never fails: it waits. That is how the map step hung four times in twelve days, each time sitting
 * until the daily job's wall-clock cap killed it half an hour later. A page read finishes in well
 * under a second, so anything approaching this is already dead.
 */
export const OPERATION_TIMEOUT_MS = 30_000;
/** Replacing the whole map is a far bigger unit of work than reading one page of it. */
export const BULK_TIMEOUT_MS = 120_000;

/**
 * Runs an idempotent database operation, retrying when the connection drops. The driver's own
 * retryable writes don't cover everything (deleteMany, for one), and a long run shouldn't die on a blip.
 */
export async function withMongoRetry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // An expired timeoutMS is exactly the case this exists for: the deadline turns a hung call
      // into an error so it can be tried again, which only helps if it counts as worth retrying.
      const transient =
        error instanceof MongoNetworkError ||
        error instanceof MongoServerSelectionError ||
        error instanceof MongoOperationTimeoutError;
      if (!transient || attempt >= maxAttempts) throw error;
      const waitSeconds = 2 ** attempt;
      console.warn(`[mongo] ${label} failed (${error.message}); retrying in ${waitSeconds}s`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
  }
}

/**
 * Opens the connection, retrying a brief failure to reach the cluster.
 *
 * withMongoRetry covers operations, not this: a blip while connecting took down the benchmark step
 * on 2026-10-04 even though the same job's embedding and map had just succeeded against the same
 * cluster. Each attempt gets a fresh client, because one whose connect failed keeps a closed
 * topology that will not reconnect.
 */
export async function connectToDatabase(
  uri: string,
  dbName: string,
): Promise<{ client: MongoClient; db: Db }> {
  const client = await withMongoRetry(
    "Connecting to MongoDB",
    async () => {
      const candidate = new MongoClient(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
      try {
        await candidate.connect();
        return candidate;
      } catch (error) {
        await candidate.close().catch(() => {});
        throw error;
      }
    },
    CONNECT_ATTEMPTS,
  );
  return { client, db: client.db(dbName) };
}
