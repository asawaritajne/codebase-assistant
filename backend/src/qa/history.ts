import { ObjectId, type Db } from "mongodb";
import { withMongoRetry } from "../db/mongo.js";
import type { AnswerSource, AskResult } from "./ask.js";

export const QUERY_HISTORY_COLLECTION = "query_history";
/** Enough of each source to show on a shared answer page without storing whole chunks twice. */
const SHARED_EXCERPT_CHARS = 700;

export interface SharedAnswer extends Omit<AskResult, "shareId"> {
  id: string;
  repo: string;
  repoId: string;
  createdAt: string;
}

const shareableSource = (source: AnswerSource): AnswerSource => ({
  ...source,
  text: source.text.slice(0, SHARED_EXCERPT_CHARS),
});

/**
 * Records a question and its answer, and returns the id that makes it shareable. History doubles as
 * the record behind every /a/<id> link, so answers are stored with enough of their sources to
 * re-display them.
 */
export async function recordQuery(
  db: Db,
  repoId: string,
  repoFullName: string,
  result: Omit<AskResult, "shareId">,
): Promise<string | null> {
  try {
    return await withMongoRetry("Recording query history", async () => {
      const { insertedId } = await db.collection(QUERY_HISTORY_COLLECTION).insertOne({
        repo: repoFullName,
        repoId,
        question: result.question,
        answer: result.answer,
        sources: result.sources.map(shareableSource),
        citations: result.citations,
        regenerated: result.regenerated,
        model: result.model,
        embeddingModel: result.embeddingModel,
        retrievalMs: result.retrievalMs,
        latencyMs: result.latencyMs,
        createdAt: new Date(),
      });
      return insertedId.toHexString();
    });
  } catch (error) {
    // History is a nicety; never fail a good answer because logging it didn't work.
    console.warn(`[ask] Could not record query history: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function readSharedAnswer(db: Db, id: string): Promise<SharedAnswer | null> {
  if (!ObjectId.isValid(id)) return null;
  const stored = await db.collection(QUERY_HISTORY_COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!stored) return null;

  return {
    id,
    repo: (stored.repo as string) ?? "",
    repoId: (stored.repoId as string) ?? "",
    question: stored.question as string,
    answer: stored.answer as string,
    sources: (stored.sources as AnswerSource[]) ?? [],
    citations: stored.citations as SharedAnswer["citations"],
    regenerated: Boolean(stored.regenerated),
    model: (stored.model as string) ?? "",
    embeddingModel: (stored.embeddingModel as string) ?? "",
    retrievalMs: (stored.retrievalMs as number) ?? 0,
    latencyMs: (stored.latencyMs as number) ?? 0,
    createdAt: (stored.createdAt as Date)?.toISOString() ?? new Date().toISOString(),
  };
}
