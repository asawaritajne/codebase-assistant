// Usage: npm run ingest [-- --repo express --repo axios]   (default: every configured repo)
import { ingestionOptionsFor } from "../config/repos.js";
import { loadConfig } from "../config/env.js";
import { connectToDatabase } from "../db/mongo.js";
import { GitHubClient } from "../ingestion/github.js";
import { runIngestion } from "../ingestion/ingest.js";
import { selectRepos } from "./args.js";

async function main(): Promise<void> {
  const repos = selectRepos(process.argv.slice(2));
  const config = loadConfig();
  const { client, db } = await connectToDatabase(config.mongoUri, config.mongoDbName);
  const github = new GitHubClient(config.githubToken);
  try {
    for (const repo of repos) {
      const summary = await runIngestion(db, github, ingestionOptionsFor(repo));
      if (!summary.completed) {
        // A rate limit would stop the remaining repos too.
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
