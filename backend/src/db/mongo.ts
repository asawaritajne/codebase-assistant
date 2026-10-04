import { MongoClient, MongoNetworkError, MongoServerSelectionError, type Db } from "mongodb";

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
      const transient = error instanceof MongoNetworkError || error instanceof MongoServerSelectionError;
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
