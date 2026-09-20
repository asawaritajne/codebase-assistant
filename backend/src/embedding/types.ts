import type { ObjectId } from "mongodb";
import type { RawDocument, SourceType } from "../ingestion/types.js";

/** Written onto a raw_ingestion document once its chunks are embedded and stored. */
export interface EmbeddingStatus {
  /** Hash of the embedded text; a mismatch means the document changed since. */
  fingerprint: string;
  model: string;
  dimensions: number;
  chunkerVersion: number;
  chunkCount: number;
  embeddedAt: Date;
}

export type RawDocumentWithEmbeddingStatus = RawDocument & { embeddingStatus?: EmbeddingStatus };

export interface EmbeddedChunk {
  rawDocumentId: ObjectId;
  repo: string;
  type: SourceType;
  sourceId: string;
  /** Link used for citations; code chunks point at their exact line range. */
  sourceUrl: string;
  /** File path, commit subject, or PR title. */
  title: string;
  chunkIndex: number;
  /** The original, unmodified chunk text. */
  text: string;
  startLine?: number;
  endLine?: number;
  isTest: boolean;
  embedding: number[];
  embeddingModel: string;
  createdAt: Date;
}
