// Usage: npm run eval [-- --repo express --repo zustand] [--dry-run]   (default: every repo)
import { loadConfig } from "../config/env.js";
import { connectToDatabase } from "../db/mongo.js";
import { GeminiEmbedder } from "../embedding/gemini.js";
import { casesForRepos } from "../eval/dataset.js";
import { runEvaluation, saveEvalRun } from "../eval/run.js";
import { hasFlag, selectRepos } from "./args.js";

const pad = (value: string, width: number) => value.padEnd(width);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "dry-run");
  const repoIds = selectRepos(argv).map((repo) => repo.id);
  const cases = casesForRepos(repoIds.length === 0 ? [] : repoIds);
  if (cases.length === 0) throw new Error("No benchmark cases match those repositories");

  const config = loadConfig();
  const { client, db } = await connectToDatabase(config.mongoUri, config.mongoDbName);
  try {
    console.log(`[eval] Running ${cases.length} cases (${cases.length} embeddings)…`);
    const run = await runEvaluation(db, new GeminiEmbedder(config.geminiApiKey), cases);

    for (const result of run.results) {
      const status = result.skipped ? `skip (${result.skipped})` : result.rank === null ? "MISS" : `#${result.rank}`;
      console.log(
        `  ${pad(status, 22)} ${pad(result.id, 22)} ${result.rank === null ? result.expect[0] : result.retrieved[0]!.title}`,
      );
    }

    const { overall, overallBaseline: baseline } = run;
    console.log(
      `\n[eval] ${overall.cases} cases · hit@1 ${overall.hitAt1}% · hit@3 ${overall.hitAt3}% · ` +
        `hit@5 ${overall.hitAt5}% · MRR ${overall.mrr} · ${overall.misses} missed`,
    );
    if (baseline) {
      console.log(
        `       plain search:    hit@1 ${baseline.hitAt1}% · hit@3 ${baseline.hitAt3}% · ` +
          `hit@5 ${baseline.hitAt5}% · MRR ${baseline.mrr} · ${baseline.misses} missed`,
      );
    }

    const missed = run.results.filter((result) => !result.skipped && result.rank === null);
    if (missed.length > 0) {
      console.log("\n[eval] Missed, with what was retrieved instead:");
      for (const result of missed) {
        console.log(`  ${result.id} — expected ${result.expect.join(" or ")}`);
        console.log(`    got: ${result.retrieved.map((file) => file.title).join(", ")}`);
      }
    }
    for (const repo of run.repos) {
      console.log(`       ${pad(repo.repo, 32)} hit@5 ${repo.hitAt5}%  MRR ${repo.mrr}  (${repo.cases} cases)`);
    }

    if (dryRun) console.log("\n[eval] --dry-run: not saved");
    else {
      await saveEvalRun(db, run);
      console.log("\n[eval] Saved; /evaluation now serves this run");
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(`[eval] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
