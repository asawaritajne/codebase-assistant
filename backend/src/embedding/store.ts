import type { Collection, Db, ObjectId } from "mongodb";
import type { EmbeddedChunk } from "./types.js";

export const EMBEDDED_CHUNKS_COLLECTION = "embedded_chunks";
/** Must match the Atlas Vector Search index name (see backend/atlas/embedded_chunks.vector-index.json). */
export const VECTOR_INDEX_NAME = "vector_index";

export async function getEmbeddedChunksCollection(db: Db): Promise<Collection<EmbeddedChunk>> {
  const collection = db.collection<EmbeddedChunk>(EMBEDDED_CHUNKS_COLLECTION);
  await collection.createIndex({ rawDocumentId: 1, chunkIndex: 1 }, { unique: true });
  return collection;
}

/** Swaps out a document's chunks, so re-embedding a changed document leaves no stale chunks behind. */
export async function replaceChunks(
  collection: Collection<EmbeddedChunk>,
  rawDocumentId: ObjectId,
  chunks: EmbeddedChunk[],
): Promise<void> {
  await collection.deleteMany({ rawDocumentId });
  if (chunks.length > 0) await collection.insertMany(chunks);
}

/** Returns null when the cluster doesn't allow listing search indexes through the driver. */
export async function hasVectorIndex(collection: Collection<EmbeddedChunk>): Promise<boolean | null> {
  try {
    return (await collection.listSearchIndexes(VECTOR_INDEX_NAME).toArray()).length > 0;
  } catch {
    return null;
  }
}
