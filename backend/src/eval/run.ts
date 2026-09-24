import type { Db } from "mongodb";
import { findRepo } from "../config/repos.js";
import { withMongoRetry } from "../db/mongo.js";
import { EMBEDDING_MODEL, formatQueryForEmbedding, type GeminiEmbedder } from "../embedding/gemini.js";
import { NON_TEST_FLOOR } from "../qa/ask.js";
import { retrieveRelevantChunks } from "../retrieval/search.js";
import { EVAL_CASES, type EvalCase } from "./dataset.js";

export const EVAL_RUNS_COLLECTION = "eval_runs";
/**
 * Embedded benchmark questions, kept between runs. The questions are fixed, so re-running after a
 * change to retrieval should cost nothing — the daily embedding quota is small and shared with the
 * questions real readers ask.
 */
export const EVAL_VECTORS_COLLECTION = "eval_question_vectors";
/** How many results each question is judged on. Matches what answering actually retrieves. */
export const EVAL_LIMIT = 5;

export interface RetrievedFile {
  title: string;
  type: string;
  score: number;
  sourceUrl: string;
}

export interface CaseResult extends EvalCase {
  /** Distinct files retrieved, best first — chunks of one file collapse to a single entry. */
  retrieved: RetrievedFile[];
  /** 1-based position of the first expected file, or null when it wasn't retrieved at all. */
  rank: number | null;
  /** The same question under the plain search, for comparison; absent on baseline runs. */
  baseline?: RetrievedFile[];
  rankBaseline?: number | null;
  /** Set when the repository has nothing indexed yet, so the case couldn't be judged. */
  skipped?: string;
}

export interface EvalScore {
  cases: number;
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  /** Mean reciprocal rank: 1.0 if every question's file came first, 0.5 if typically second. */
  mrr: number;
  misses: number;
}

export interface RepoScore extends EvalScore {
  repoId: string;
  repo: string;
}

export interface EvalRun {
  startedAt: string;
  finishedAt: string;
  embeddingModel: string;
  limit: number;
  /**
   * Which retrieval policy was measured: "baseline" is the plain vector search, "non-test-floor"
   * reserves slots for implementation files the way answering now does.
   */
  policy?: "baseline" | "non-test-floor";
  overall: EvalScore;
  /** The plain search scored on the same questions, when the run measured the floor policy. */
  overallBaseline?: EvalScore;
  /** Questions that had to be embedded for this run; the rest came from the cache. */
  embeddedQuestions?: number;
  repos: RepoScore[];
  results: CaseResult[];
}

const rate = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/**
 * Scores judged cases. Pure, so the arithmetic is testable without Atlas or Gemini. `variant`
 * chooses which of the two searches to score: the one every question really runs, or the same
 * search with test files excluded.
 */
export function scoreResults(results: CaseResult[], variant: "policy" | "baseline" = "policy"): EvalScore {
  const judged = results.filter((result) => !result.skipped);
  if (judged.length === 0) return { cases: 0, hitAt1: 0, hitAt3: 0, hitAt5: 0, mrr: 0, misses: 0 };

  const rankOf = (result: CaseResult) => (variant === "policy" ? result.rank : (result.rankBaseline ?? null));
  const within = (depth: number) =>
    judged.filter((result) => rankOf(result) !== null && rankOf(result)! <= depth).length;
  const reciprocal = judged.reduce((sum, result) => sum + (rankOf(result) === null ? 0 : 1 / rankOf(result)!), 0);

  return {
    cases: judged.length,
    hitAt1: rate(within(1), judged.length),
    hitAt3: rate(within(3), judged.length),
    hitAt5: rate(within(EVAL_LIMIT), judged.length),
    mrr: Math.round((reciprocal / judged.length) * 1000) / 1000,
    misses: judged.filter((result) => rankOf(result) === null).length,
  };
}

export function scoreByRepo(results: CaseResult[], variant: "policy" | "baseline" = "policy"): RepoScore[] {
  const byRepo = new Map<string, CaseResult[]>();
  for (const result of results) {
    byRepo.set(result.repoId, [...(byRepo.get(result.repoId) ?? []), result]);
  }
  return [...byRepo.entries()]
    .map(([repoId, list]) => ({
      repoId,
      repo: findRepo(repoId)?.fullName ?? repoId,
      ...scoreResults(list, variant),
    }))
    .filter((repo) => repo.cases > 0)
    .sort((a, b) => b.hitAt5 - a.hitAt5 || a.repo.localeCompare(b.repo));
}

/** Position of the first expected file among the retrieved files, 1-based. */
export function rankOfExpected(retrieved: RetrievedFile[], expect: string[]): number | null {
  const index = retrieved.findIndex((file) => expect.includes(file.title));
  return index === -1 ? null : index + 1;
}

/** Collapses chunks to distinct files, keeping each file's best-scoring chunk. */
function distinctFiles(
  chunks: { title: string; type: string; score: number; sourceUrl: string }[],
): RetrievedFile[] {
  const files: RetrievedFile[] = [];
  for (const chunk of chunks) {
    if (!files.some((file) => file.title === chunk.title)) {
      files.push({ title: chunk.title, type: chunk.type, score: chunk.score, sourceUrl: chunk.sourceUrl });
    }
  }
  return files;
}

/**
 * Question vectors for these cases, embedding only the ones not already cached. The benchmark's
 * questions never change, so after the first run this costs no quota at all.
 */
async function questionVectors(
  db: Db,
  embedder: GeminiEmbedder,
  cases: EvalCase[],
): Promise<{ vectors: number[][]; embedded: number }> {
  const collection = db.collection<{ key: string; vector: number[] }>(EVAL_VECTORS_COLLECTION);
  await collection.createIndex({ key: 1 }, { unique: true });

  const keyFor = (testCase: EvalCase) => `${EMBEDDING_MODEL}|${testCase.question}`;
  const cached = new Map(
    (await collection.find({ key: { $in: cases.map(keyFor) } }).toArray()).map((row) => [row.key, row.vector]),
  );

  const missing = cases.filter((testCase) => !cached.has(keyFor(testCase)));
  if (missing.length > 0) {
    console.log(`[eval] Embedding ${missing.length} question(s); ${cases.length - missing.length} came from the cache`);
    const fresh = await embedder.embed(missing.map((testCase) => formatQueryForEmbedding(testCase.question)));
    await collection.insertMany(
      missing.map((testCase, index) => ({ key: keyFor(testCase), vector: fresh[index]!, createdAt: new Date() })),
    );
    missing.forEach((testCase, index) => cached.set(keyFor(testCase), fresh[index]!));
  }

  return { vectors: cases.map((testCase) => cached.get(keyFor(testCase))!), embedded: missing.length };
}

/**
 * Runs the benchmark: embed every question (once, ever), search each against its own repository,
 * and record where the expected file landed. No generation is involved.
 */
export async function runEvaluation(
  db: Db,
  embedder: GeminiEmbedder,
  cases: EvalCase[] = EVAL_CASES,
  { limit = EVAL_LIMIT, minNonTest = NON_TEST_FLOOR }: { limit?: number; minNonTest?: number } = {},
): Promise<EvalRun> {
  const startedAt = new Date();
  const { vectors, embedded } = await questionVectors(db, embedder, cases);

  const results: CaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    const repo = findRepo(testCase.repoId);
    const empty = { retrieved: [], rank: null, baseline: [], rankBaseline: null };
    if (!repo) {
      results.push({ ...testCase, ...empty, skipped: "unknown repository" });
      continue;
    }

    // Code only: the benchmark asks where something is implemented, and a commit that mentions the
    // file is not the same as the file. Both searches re-use the one question vector, so measuring
    // the policy against the plain baseline costs no embedding quota.
    const filter = { repo: repo.fullName, type: "code" };
    const [chunks, plain] = await Promise.all([
      retrieveRelevantChunks(db, vectors[index]!, { limit, filter, minNonTest }),
      retrieveRelevantChunks(db, vectors[index]!, { limit, filter }),
    ]);
    if (plain.length === 0) {
      results.push({ ...testCase, ...empty, skipped: "not indexed yet" });
      continue;
    }

    const retrieved = distinctFiles(chunks);
    const baseline = distinctFiles(plain);
    results.push({
      ...testCase,
      retrieved,
      rank: rankOfExpected(retrieved, testCase.expect),
      baseline,
      rankBaseline: rankOfExpected(baseline, testCase.expect),
    });
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    limit,
    embeddedQuestions: embedded,
    policy: minNonTest > 0 ? "non-test-floor" : "baseline",
    overall: scoreResults(results),
    overallBaseline: minNonTest > 0 ? scoreResults(results, "baseline") : undefined,
    repos: scoreByRepo(results),
    results,
  };
}

export async function saveEvalRun(db: Db, run: EvalRun): Promise<void> {
  await withMongoRetry("Saving evaluation run", () =>
    db.collection(EVAL_RUNS_COLLECTION).insertOne({ ...run, createdAt: new Date() }),
  );
}

/** The most recent run, or null before the benchmark has ever been run. */
export async function readLatestEvalRun(db: Db): Promise<EvalRun | null> {
  const [latest] = await withMongoRetry("Reading evaluation run", () =>
    db.collection(EVAL_RUNS_COLLECTION).find({}, { projection: { _id: 0, createdAt: 0 } }).sort({ createdAt: -1 }).limit(1).toArray(),
  );
  return (latest as EvalRun | undefined) ?? null;
}
