import { createHash } from "node:crypto";
import type { Db, WithId } from "mongodb";
import { withMongoRetry } from "../db/mongo.js";
import { GeminiQuotaExhaustedError } from "../gemini/client.js";
import { RAW_INGESTION_COLLECTION } from "../ingestion/store.js";
import type { RawDocument, SourceType } from "../ingestion/types.js";
import { CHUNKER_VERSION, chunkRawDocument, estimateTokens, type DocumentChunk } from "./chunker.js";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  formatDocumentForEmbedding,
  type GeminiEmbedder,
} from "./gemini.js";
import { EMBEDDED_CHUNKS_COLLECTION, VECTOR_INDEX_NAME, getEmbeddedChunksCollection, hasVectorIndex, replaceChunks } from "./store.js";
import type { EmbeddedChunk, RawDocumentWithEmbeddingStatus } from "./types.js";

/** Chunks embedded and saved together; a run that stops early keeps every finished group. */
const CHUNKS_PER_GROUP = 100;
const SOURCE_TYPES = ["code", "commit", "pr"] as const;

export interface EmbeddingOptions {
  /** Repositories ("owner/name") to embed, in priority order. */
  repos: string[];
  dryRun: boolean;
  /** Embed at most this many chunks, leaving the rest of the day's quota for questions. */
  maxChunks: number;
}

export interface EmbeddingSummary {
  /** False when the quota or the chunk budget stopped the run before every pending document. */
  completed: boolean;
  stoppedBy: "quota" | "budget" | null;
  dryRun: boolean;
  pendingDocuments: number;
  plannedChunks: number;
  embeddedDocuments: number;
  embeddedChunks: Record<SourceType, number>;
  /** Chunks stored in embedded_chunks after the run, across all repos and earlier runs. */
  collectionTotal: number;
  durationMs: number;
}

interface PendingDocument {
  doc: WithId<RawDocumentWithEmbeddingStatus>;
  fingerprint: string;
  chunks: DocumentChunk[];
}

const log = (message: string) => console.log(`[embed] ${message}`);
const sum = (counts: Record<SourceType, number>) => counts.code + counts.commit + counts.pr;
const chunkCount = (items: PendingDocument[]) => items.reduce((total, item) => total + item.chunks.length, 0);

function fingerprint(doc: RawDocument): string {
  // PR titles are embedded too, so a retitled PR counts as changed.
  const text = doc.type === "pr" ? `${doc.title}\n${doc.content}` : doc.content;
  return createHash("sha256").update(text).digest("hex");
}

function needsEmbedding(doc: RawDocumentWithEmbeddingStatus, currentFingerprint: string): boolean {
  const status = doc.embeddingStatus;
  return !(
    status?.fingerprint === currentFingerprint &&
    status.model === EMBEDDING_MODEL &&
    status.dimensions === EMBEDDING_DIMENSIONS &&
    status.chunkerVersion === CHUNKER_VERSION
  );
}

function logPlan(repos: string[], pending: PendingDocument[], documentsPerRepo: Map<string, number>): void {
  for (const repo of repos) {
    const total = documentsPerRepo.get(repo) ?? 0;
    const items = pending.filter(({ doc }) => doc.repo === repo);
    if (total === 0) {
      log(`  ${repo}: nothing ingested yet (run npm run ingest first)`);
      continue;
    }
    if (items.length === 0) {
      log(`  ${repo}: up to date (${total} documents)`);
      continue;
    }
    const chunks = items.flatMap((item) => item.chunks);
    const byType = SOURCE_TYPES.map((type) => `${chunkCount(items.filter(({ doc }) => doc.type === type))} ${type}`);
    const average = chunks.length ? Math.round(chunks.reduce((n, c) => n + estimateTokens(c.text), 0) / chunks.length) : 0;
    log(
      `  ${repo}: ${items.length} of ${total} documents -> ${chunks.length} chunks ` +
        `(${byType.join(", ")}; ${chunks.filter((c) => c.isTest).length} from tests; ~${average} tokens avg)`,
    );
  }
}

export async function runEmbedding(
  db: Db,
  embedder: GeminiEmbedder,
  { repos, dryRun, maxChunks }: EmbeddingOptions,
): Promise<EmbeddingSummary> {
  const startedAt = Date.now();
  const rawCollection = db.collection<RawDocumentWithEmbeddingStatus>(RAW_INGESTION_COLLECTION);
  const priority = new Map(repos.map((repo, index) => [repo, index]));

  const allDocs = await rawCollection.find({ repo: { $in: repos } }).toArray();
  const documentsPerRepo = new Map<string, number>();
  const pending: PendingDocument[] = [];
  for (const doc of allDocs) {
    documentsPerRepo.set(doc.repo, (documentsPerRepo.get(doc.repo) ?? 0) + 1);
    const currentFingerprint = fingerprint(doc);
    if (needsEmbedding(doc, currentFingerprint)) {
      pending.push({ doc, fingerprint: currentFingerprint, chunks: chunkRawDocument(doc) });
    }
  }
  // Earlier repos first (sort is stable, so each repo keeps its stored order).
  pending.sort((a, b) => priority.get(a.doc.repo)! - priority.get(b.doc.repo)!);

  const plannedChunks = chunkCount(pending);
  log(`${pending.length} of ${allDocs.length} documents need embedding (${plannedChunks} chunks)`);
  logPlan(repos, pending, documentsPerRepo);

  // Whole documents only: take them in order until the next one would go over the budget.
  const thisRun: PendingDocument[] = [];
  let budgeted = 0;
  for (const item of pending) {
    if (budgeted + item.chunks.length > maxChunks) break;
    thisRun.push(item);
    budgeted += item.chunks.length;
  }
  const overBudget = thisRun.length < pending.length;
  if (overBudget) {
    log(
      `This run is capped at ${maxChunks} chunks (--max-chunks), so it covers ${budgeted} chunks from ` +
        `${thisRun.length} documents; run it again once the daily quota resets to continue`,
    );
  }

  const embeddedChunks: Record<SourceType, number> = { code: 0, commit: 0, pr: 0 };
  let embeddedDocuments = 0;
  let stoppedBy: EmbeddingSummary["stoppedBy"] = null;

  if (dryRun) {
    log("Dry run: nothing was sent to Gemini or written to MongoDB");
    return {
      completed: !overBudget,
      stoppedBy: overBudget ? "budget" : null,
      dryRun,
      pendingDocuments: pending.length,
      plannedChunks,
      embeddedDocuments,
      embeddedChunks,
      collectionTotal: await db.collection(EMBEDDED_CHUNKS_COLLECTION).countDocuments(),
      durationMs: Date.now() - startedAt,
    };
  }

  const chunkCollection = await getEmbeddedChunksCollection(db);

  const embedGroup = async (group: PendingDocument[]) => {
    const inputs = group.flatMap(({ chunks }) => chunks.map((chunk) => formatDocumentForEmbedding(chunk.title, chunk.text)));
    const vectors = inputs.length > 0 ? await embedder.embed(inputs) : [];

    let next = 0;
    for (const { doc, fingerprint: docFingerprint, chunks } of group) {
      const records: EmbeddedChunk[] = chunks.map((chunk, chunkIndex) => ({
        rawDocumentId: doc._id,
        repo: doc.repo,
        type: doc.type,
        sourceId: doc.sourceId,
        ...chunk,
        chunkIndex,
        embedding: vectors[next++]!,
        embeddingModel: EMBEDDING_MODEL,
        createdAt: new Date(),
      }));
      // Both writes are idempotent, so a dropped connection is retried without re-embedding. The
      // status is written last, so a run that dies mid-document simply redoes it next time.
      await withMongoRetry(`Saving chunks for ${doc.sourceId}`, async () => {
        await replaceChunks(chunkCollection, doc._id, records);
        await rawCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              embeddingStatus: {
                fingerprint: docFingerprint,
                model: EMBEDDING_MODEL,
                dimensions: EMBEDDING_DIMENSIONS,
                chunkerVersion: CHUNKER_VERSION,
                chunkCount: records.length,
                embeddedAt: new Date(),
              },
            },
          },
        );
      });
      embeddedChunks[doc.type] += records.length;
      embeddedDocuments++;
    }
    log(`Progress: ${sum(embeddedChunks)}/${budgeted} chunks, ${embeddedDocuments}/${thisRun.length} documents`);
  };

  try {
    let group: PendingDocument[] = [];
    let groupChunks = 0;
    for (const item of thisRun) {
      if (group.length > 0 && groupChunks + item.chunks.length > CHUNKS_PER_GROUP) {
        await embedGroup(group);
        group = [];
        groupChunks = 0;
      }
      group.push(item);
      groupChunks += item.chunks.length;
    }
    if (group.length > 0) await embedGroup(group);
    if (overBudget) stoppedBy = "budget";
  } catch (error) {
    if (!(error instanceof GeminiQuotaExhaustedError)) throw error;
    stoppedBy = "quota";
    console.error(
      `[embed] ${error.message}\n[embed] Stopping early; every finished document was saved. ` +
        "Re-run `npm run embed` once the quota resets to embed the rest.",
    );
  }

  const summary: EmbeddingSummary = {
    completed: stoppedBy === null,
    stoppedBy,
    dryRun,
    pendingDocuments: pending.length,
    plannedChunks,
    embeddedDocuments,
    embeddedChunks,
    collectionTotal: await chunkCollection.countDocuments(),
    durationMs: Date.now() - startedAt,
  };

  const outcome = { quota: "Stopped by the Gemini quota", budget: "Reached this run's chunk budget", none: "Finished" };
  log(`${outcome[stoppedBy ?? "none"]} in ${(summary.durationMs / 1000).toFixed(1)}s`);
  for (const type of SOURCE_TYPES) log(`  ${type.padEnd(6)} ${embeddedChunks[type]} chunks embedded`);
  log(`  ${plannedChunks - sum(embeddedChunks)} chunks still pending; embedded_chunks holds ${summary.collectionTotal} chunks`);

  if ((await hasVectorIndex(chunkCollection)) === false) {
    log(
      `Vector Search index "${VECTOR_INDEX_NAME}" not found yet. Create it in the Atlas UI ` +
        "using backend/atlas/embedded_chunks.vector-index.json.",
    );
  }

  return summary;
}
