import type { AnyBulkWriteOperation, Collection, Db } from "mongodb";
import type { RawDocument } from "./types.js";

export const RAW_INGESTION_COLLECTION = "raw_ingestion";

export async function getRawIngestionCollection(db: Db): Promise<Collection<RawDocument>> {
  const collection = db.collection<RawDocument>(RAW_INGESTION_COLLECTION);
  // Makes re-running ingestion update documents in place instead of duplicating them.
  await collection.createIndex({ repo: 1, type: 1, sourceId: 1 }, { unique: true });
  return collection;
}

export interface SaveResult {
  inserted: number;
  updated: number;
}

export async function saveRawDocuments(
  collection: Collection<RawDocument>,
  docs: RawDocument[],
): Promise<SaveResult> {
  if (docs.length === 0) return { inserted: 0, updated: 0 };

  const operations: AnyBulkWriteOperation<RawDocument>[] = docs.map((doc) => ({
    updateOne: {
      filter: { repo: doc.repo, type: doc.type, sourceId: doc.sourceId },
      update: { $set: doc },
      upsert: true,
    },
  }));
  const result = await collection.bulkWrite(operations, { ordered: false });
  return { inserted: result.upsertedCount, updated: result.matchedCount };
}
