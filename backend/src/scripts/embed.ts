// Usage: npm run embed [-- --repo zustand] [--max-chunks 900] [--dry-run]   (default: every repo)
import { loadConfig } from "../config/env.js";
import { connectToDatabase } from "../db/mongo.js";
import { runEmbedding } from "../embedding/embed.js";
import { GeminiEmbedder } from "../embedding/gemini.js";
import { hasFlag, numberFlag, selectRepos } from "./args.js";

/**
 * Gemini's free tier allows roughly 1,000 embeddings a day, shared with the questions asked on the
 * site. A 900-chunk run still hit the daily limit (retries and questions count too), so the default
 * leaves a wider margin; pass --max-chunks to override.
 */
const DEFAULT_MAX_CHUNKS = 750;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repos = selectRepos(argv);
  const config = loadConfig();
  const { client, db } = await connectToDatabase(config.mongoUri, config.mongoDbName);
  try {
    const summary = await runEmbedding(db, new GeminiEmbedder(config.geminiApiKey), {
      repos: repos.map((repo) => repo.fullName),
      dryRun: hasFlag(argv, "dry-run"),
      maxChunks: numberFlag(argv, "max-chunks", DEFAULT_MAX_CHUNKS),
    });
    // Stopping at the budget is expected; only a quota stop signals trouble.
    if (summary.stoppedBy === "quota") process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(`[embed] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
