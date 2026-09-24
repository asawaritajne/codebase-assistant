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
  /**
   * Slots reserved for non-test chunks. Test files restate the question in their names
   * ("cancel", "persist", "subscribe"), so they can take every slot and leave the answer with no
   * implementation to cite — the retrieval benchmark has cases where that happened outright.
   */
  minNonTest?: number;
}

const chunkKey = (chunk: RetrievedChunk) => `${chunk.sourceId}#${chunk.chunkIndex}`;

/**
 * Merges the unrestricted results with a non-test-only search, so at least `minNonTest` of the
 * returned chunks are implementation. Both lists stay in score order and nothing is invented:
 * every chunk returned was retrieved by one of the two searches.
 */
export function mergeWithNonTestFloor(
  ranked: RetrievedChunk[],
  nonTest: RetrievedChunk[],
  limit: number,
  minNonTest: number,
): RetrievedChunk[] {
  const merged: RetrievedChunk[] = [];
  const seen = new Set<string>();
  const add = (chunk: RetrievedChunk) => {
    if (seen.has(chunkKey(chunk))) return;
    seen.add(chunkKey(chunk));
    merged.push(chunk);
  };

  // Whatever the unrestricted search already found that isn't a test counts towards the floor.
  const promoted = ranked.filter((chunk) => !chunk.isTest).slice(0, minNonTest);
  promoted.forEach(add);
  nonTest.slice(0, Math.max(minNonTest - promoted.length, 0)).forEach(add);

  for (const chunk of ranked) {
    if (merged.length >= limit) break;
    add(chunk);
  }

  // Keep the best-scoring chunk first, so the numbering in the prompt still reflects closeness.
  return merged.slice(0, limit).sort((a, b) => b.score - a.score);
}

async function search(
  db: Db,
  queryVector: number[],
  limit: number,
  filter?: Record<string, unknown>,
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

/**
 * Finds the chunks closest in meaning to an embedded question. Phase 5 can replace the body with
 * an HTTP call to the Spring Boot service without changing any caller.
 */
export async function retrieveRelevantChunks(
  db: Db,
  queryVector: number[],
  { limit, filter, minNonTest = 0 }: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  if (minNonTest <= 0) return search(db, queryVector, limit, filter);

  // A second search on the same vector costs no embedding quota, only a little Atlas time.
  const [ranked, nonTest] = await Promise.all([
    search(db, queryVector, limit, filter),
    search(db, queryVector, minNonTest, { ...filter, isTest: false }),
  ]);
  return mergeWithNonTestFloor(ranked, nonTest, limit, minNonTest);
}
