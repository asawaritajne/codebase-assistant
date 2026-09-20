import type { Db } from "mongodb";
import { GitHubRateLimitError, type GitHubClient } from "./github.js";
import {
  fetchCodeDocument,
  fetchCommitDocuments,
  fetchMergedPullRequestDocuments,
  resolveSourceTree,
} from "./sources.js";
import { getRawIngestionCollection, saveRawDocuments, type SaveResult } from "./store.js";
import type { CodeDocument, IngestionOptions, SourceType } from "./types.js";

/** Files fetched in parallel and saved together, so a mid-run failure keeps earlier batches. */
const CODE_BATCH_SIZE = 10;

export interface IngestionSummary {
  repo: string;
  /** False when a rate limit stopped the run before every source was ingested. */
  completed: boolean;
  rateLimitResetAt: Date | null;
  saved: Record<SourceType, SaveResult>;
  skippedBinaryFiles: number;
  /** Documents stored for this repo after the run, including earlier runs. */
  collectionTotal: number;
  durationMs: number;
}

const log = (message: string) => console.log(`[ingest] ${message}`);

export async function runIngestion(
  db: Db,
  github: GitHubClient,
  { repo, sourceDirs, commitLimit, pullRequestLimit }: IngestionOptions,
): Promise<IngestionSummary> {
  const startedAt = Date.now();
  const collection = await getRawIngestionCollection(db);
  const saved: Record<SourceType, SaveResult> = {
    code: { inserted: 0, updated: 0 },
    commit: { inserted: 0, updated: 0 },
    pr: { inserted: 0, updated: 0 },
  };
  const addSaved = (type: SourceType, result: SaveResult) => {
    saved[type].inserted += result.inserted;
    saved[type].updated += result.updated;
  };
  let skippedBinaryFiles = 0;
  let rateLimitResetAt: Date | null = null;

  const quota = await github.getRateLimit();
  log(`Starting ingestion of ${repo} (GitHub quota: ${quota.remaining}/${quota.limit} requests left)`);

  try {
    // Commits and PRs take only a few requests, so they go first; if the quota
    // runs out during the per-file code fetch, they are already saved.
    log(`Fetching the last ${commitLimit} commits...`);
    const commits = await fetchCommitDocuments(github, repo, commitLimit);
    addSaved("commit", await saveRawDocuments(collection, commits));
    log(`Commits: saved ${commits.length}`);

    log(`Fetching the last ${pullRequestLimit} merged pull requests...`);
    const pullRequests = await fetchMergedPullRequestDocuments(github, repo, pullRequestLimit);
    addSaved("pr", await saveRawDocuments(collection, pullRequests));
    log(`Pull requests: saved ${pullRequests.length}`);

    log(`Listing code files under ${sourceDirs.map((dir) => `${dir}/`).join(", ")}...`);
    const tree = await resolveSourceTree(github, repo, sourceDirs);
    const skipped = tree.skippedFiles > 0 ? ` (skipped ${tree.skippedFiles} non-code or oversized files)` : "";
    log(`Found ${tree.files.length} code files on ${tree.branch} @ ${tree.commitSha.slice(0, 7)}${skipped}`);

    for (let i = 0; i < tree.files.length; i += CODE_BATCH_SIZE) {
      const batch = tree.files.slice(i, i + CODE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((file) => fetchCodeDocument(github, repo, tree.commitSha, file)),
      );

      const docs: CodeDocument[] = [];
      for (const result of results) {
        if (result.status === "rejected") continue;
        if (result.value) docs.push(result.value);
        else skippedBinaryFiles++;
      }
      addSaved("code", await saveRawDocuments(collection, docs));

      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;

      const done = Math.min(i + CODE_BATCH_SIZE, tree.files.length);
      if (done % 50 === 0 || done === tree.files.length) {
        log(`Code: ${done}/${tree.files.length} files fetched`);
      }
    }
  } catch (error) {
    if (!(error instanceof GitHubRateLimitError)) throw error;
    rateLimitResetAt = error.resetAt;
    console.error(
      `[ingest] ${error.message} Stopping early; everything fetched before the limit was saved. ` +
        "Re-run ingestion after the reset to finish (existing documents are updated, not duplicated).",
    );
  }

  const summary: IngestionSummary = {
    repo,
    completed: rateLimitResetAt === null,
    rateLimitResetAt,
    saved,
    skippedBinaryFiles,
    collectionTotal: await collection.countDocuments({ repo }),
    durationMs: Date.now() - startedAt,
  };

  log(`${summary.completed ? "Finished" : "Stopped early"} in ${(summary.durationMs / 1000).toFixed(1)}s`);
  for (const type of ["code", "commit", "pr"] as const) {
    log(`  ${type.padEnd(6)} ${saved[type].inserted} new, ${saved[type].updated} updated`);
  }
  if (skippedBinaryFiles > 0) log(`  skipped ${skippedBinaryFiles} binary files`);
  log(`  raw_ingestion now holds ${summary.collectionTotal} documents for ${repo}`);

  return summary;
}
