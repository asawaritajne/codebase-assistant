import { MongoClient, MongoNetworkError, MongoServerSelectionError, type Db } from "mongodb";

const MAX_ATTEMPTS = 4;

/**
 * Runs an idempotent database operation, retrying when the connection drops. The driver's own
 * retryable writes don't cover everything (deleteMany, for one), and a long run shouldn't die on a blip.
 */
export async function withMongoRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const transient = error instanceof MongoNetworkError || error instanceof MongoServerSelectionError;
      if (!transient || attempt >= MAX_ATTEMPTS) throw error;
      const waitSeconds = 2 ** attempt;
      console.warn(`[mongo] ${label} failed (${error.message}); retrying in ${waitSeconds}s`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
  }
}

export async function connectToDatabase(
  uri: string,
  dbName: string,
): Promise<{ client: MongoClient; db: Db }> {
  // Fail fast (default is 30s) — the usual cause is the current IP not being
  // on the Atlas Network Access allowlist.
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  return { client, db: client.db(dbName) };
}
