import type { Db } from "mongodb";
import { EMBEDDED_CHUNKS_COLLECTION, VECTOR_INDEX_NAME } from "../embedding/store.js";
import type { EmbeddedChunk } from "../embedding/types.js";

/** Candidates Atlas scans before ranking; roughly 20x the returned count is a sensible start. */
const NUM_CANDIDATES = 100;

export interface RetrievedChunk extends Omit<EmbeddedChunk, "embedding" | "rawDocumentId"> {
  /** Cosine similarity to the question, 0-1. */
  score: number;
}

export interface RetrievalOptions {
  limit: number;
  /** Optional Atlas pre-filter, e.g. { isTest: false } to exclude test files. */
  filter?: Record<string, unknown>;
}

/**
 * Finds the chunks closest in meaning to an embedded question. Phase 5 can replace the body with
 * an HTTP call to the Spring Boot service without changing any caller.
 */
export async function retrieveRelevantChunks(
  db: Db,
  queryVector: number[],
  { limit, filter }: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  return db
    .collection<EmbeddedChunk>(EMBEDDED_CHUNKS_COLLECTION)
    .aggregate<RetrievedChunk>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: NUM_CANDIDATES,
          limit,
          ...(filter ? { filter } : {}),
        },
      },
      { $addFields: { score: { $meta: "vectorSearchScore" } } },
      { $unset: ["_id", "embedding", "rawDocumentId"] },
    ])
    .toArray();
}
