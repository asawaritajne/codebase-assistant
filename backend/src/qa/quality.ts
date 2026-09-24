import { ObjectId, type Db } from "mongodb";
import { withMongoRetry } from "../db/mongo.js";
import { QUERY_HISTORY_COLLECTION } from "./history.js";

/** Enough history to be representative without pulling the whole collection into memory. */
const MAX_RECORDS = 2000;
/** How many of the most recent questions the dashboard lists. */
const RECENT_LIMIT = 12;

export type Rating = "up" | "down";

export const isRating = (value: unknown): value is Rating => value === "up" || value === "down";

/** One recorded answer, reduced to the fields quality is measured on. */
export interface QualityRecord {
  id: string;
  repo: string;
  repoId: string;
  question: string;
  createdAt: Date;
  valid: boolean;
  regenerated: boolean;
  model: string;
  latencyMs: number;
  retrievalMs: number;
  sources: number;
  citedSources: number;
  uncitedParagraphs: number;
  rating: Rating | null;
}

export interface RepoQuality {
  repoId: string;
  repo: string;
  answers: number;
  passRate: number;
  medianMs: number;
  up: number;
  down: number;
}

export interface RecentAnswer {
  id: string;
  question: string;
  repoId: string;
  repo: string;
  createdAt: string;
  valid: boolean;
  regenerated: boolean;
  latencyMs: number;
  rating: Rating | null;
}

export interface QualityMetrics {
  answers: number;
  since: string | null;
  until: string | null;
  citations: { passed: number; flagged: number; passRate: number };
  regeneration: { count: number; rate: number };
  sources: { retrieved: number; cited: number; citedRate: number };
  latency: { medianMs: number; p95Ms: number; medianRetrievalMs: number };
  feedback: { up: number; down: number; rated: number; helpfulRate: number };
  models: { model: string; answers: number }[];
  repos: RepoQuality[];
  daily: { date: string; answers: number; flagged: number }[];
  recent: RecentAnswer[];
}

const EMPTY: QualityMetrics = {
  answers: 0,
  since: null,
  until: null,
  citations: { passed: 0, flagged: 0, passRate: 0 },
  regeneration: { count: 0, rate: 0 },
  sources: { retrieved: 0, cited: 0, citedRate: 0 },
  latency: { medianMs: 0, p95Ms: 0, medianRetrievalMs: 0 },
  feedback: { up: 0, down: 0, rated: 0, helpfulRate: 0 },
  models: [],
  repos: [],
  daily: [],
  recent: [],
};

const rate = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/** Nearest-rank percentile, which needs no interpolation and is stable on tiny samples. */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!;
}

/**
 * Turns recorded answers into the numbers the dashboard shows. Kept pure and separate from the
 * database read so the arithmetic can be tested without MongoDB.
 */
export function summarizeQuality(records: QualityRecord[]): QualityMetrics {
  if (records.length === 0) return EMPTY;

  const answers = records.length;
  const passed = records.filter((record) => record.valid).length;
  const regenerated = records.filter((record) => record.regenerated).length;
  const retrieved = records.reduce((sum, record) => sum + record.sources, 0);
  const cited = records.reduce((sum, record) => sum + record.citedSources, 0);
  const up = records.filter((record) => record.rating === "up").length;
  const down = records.filter((record) => record.rating === "down").length;
  const times = records.map((record) => record.latencyMs);

  const byModel = new Map<string, number>();
  const byRepo = new Map<string, { repo: string; records: QualityRecord[] }>();
  const byDay = new Map<string, { answers: number; flagged: number }>();

  for (const record of records) {
    byModel.set(record.model, (byModel.get(record.model) ?? 0) + 1);

    // Answers recorded before repositories were stored with them can't be attributed to one.
    if (record.repoId) {
      const repoEntry = byRepo.get(record.repoId) ?? { repo: record.repo, records: [] };
      repoEntry.records.push(record);
      byRepo.set(record.repoId, repoEntry);
    }

    const day = record.createdAt.toISOString().slice(0, 10);
    const dayEntry = byDay.get(day) ?? { answers: 0, flagged: 0 };
    dayEntry.answers += 1;
    if (!record.valid) dayEntry.flagged += 1;
    byDay.set(day, dayEntry);
  }

  const dates = records.map((record) => record.createdAt.getTime());

  return {
    answers,
    since: new Date(Math.min(...dates)).toISOString(),
    until: new Date(Math.max(...dates)).toISOString(),
    citations: { passed, flagged: answers - passed, passRate: rate(passed, answers) },
    regeneration: { count: regenerated, rate: rate(regenerated, answers) },
    sources: { retrieved, cited, citedRate: rate(cited, retrieved) },
    latency: {
      medianMs: percentile(times, 0.5),
      p95Ms: percentile(times, 0.95),
      medianRetrievalMs: percentile(
        records.map((record) => record.retrievalMs),
        0.5,
      ),
    },
    feedback: { up, down, rated: up + down, helpfulRate: rate(up, up + down) },
    models: [...byModel.entries()]
      .map(([model, count]) => ({ model, answers: count }))
      .sort((a, b) => b.answers - a.answers),
    repos: [...byRepo.entries()]
      .map(([repoId, { repo, records: list }]) => ({
        repoId,
        repo,
        answers: list.length,
        passRate: rate(list.filter((record) => record.valid).length, list.length),
        medianMs: percentile(
          list.map((record) => record.latencyMs),
          0.5,
        ),
        up: list.filter((record) => record.rating === "up").length,
        down: list.filter((record) => record.rating === "down").length,
      }))
      .sort((a, b) => b.answers - a.answers),
    daily: [...byDay.entries()]
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recent: records
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_LIMIT)
      .map(({ id, question, repoId, repo, createdAt, valid, regenerated: wasRegenerated, latencyMs, rating }) => ({
        id,
        question,
        repoId,
        repo,
        createdAt: createdAt.toISOString(),
        valid,
        regenerated: wasRegenerated,
        latencyMs,
        rating,
      })),
  };
}

interface StoredAnswer {
  _id: ObjectId;
  repo?: string;
  repoId?: string;
  question?: string;
  createdAt?: Date;
  citations?: { valid?: boolean; citedMarkers?: string[]; uncitedParagraphs?: string[] };
  regenerated?: boolean;
  model?: string;
  latencyMs?: number;
  retrievalMs?: number;
  sources?: unknown[];
  rating?: string;
}

const toRecord = (stored: StoredAnswer): QualityRecord => ({
  id: stored._id.toHexString(),
  repo: stored.repo ?? "",
  repoId: stored.repoId ?? "",
  question: stored.question ?? "",
  createdAt: stored.createdAt ?? new Date(0),
  valid: stored.citations?.valid !== false,
  regenerated: Boolean(stored.regenerated),
  model: stored.model ?? "unknown",
  latencyMs: stored.latencyMs ?? 0,
  retrievalMs: stored.retrievalMs ?? 0,
  sources: stored.sources?.length ?? 0,
  citedSources: stored.citations?.citedMarkers?.length ?? 0,
  uncitedParagraphs: stored.citations?.uncitedParagraphs?.length ?? 0,
  rating: isRating(stored.rating) ? stored.rating : null,
});

/** Reads the recorded answers and summarizes them. */
export async function readQualityMetrics(db: Db): Promise<QualityMetrics> {
  const stored = await withMongoRetry("Reading answer quality", () =>
    db
      .collection<StoredAnswer>(QUERY_HISTORY_COLLECTION)
      .find(
        {},
        {
          projection: {
            repo: 1,
            repoId: 1,
            question: 1,
            createdAt: 1,
            citations: 1,
            regenerated: 1,
            model: 1,
            latencyMs: 1,
            retrievalMs: 1,
            rating: 1,
            // Only the count is needed, but Mongo has no "length of array" projection worth the complexity.
            "sources.marker": 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(MAX_RECORDS)
      .toArray(),
  );

  return summarizeQuality(stored.map(toRecord));
}

/** Records a reader's verdict on one answer. Returns false when the answer doesn't exist. */
export async function recordFeedback(db: Db, id: string, rating: Rating): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const result = await withMongoRetry("Recording answer feedback", () =>
    db
      .collection(QUERY_HISTORY_COLLECTION)
      .updateOne({ _id: new ObjectId(id) }, { $set: { rating, ratedAt: new Date() } }),
  );
  return result.matchedCount > 0;
}
