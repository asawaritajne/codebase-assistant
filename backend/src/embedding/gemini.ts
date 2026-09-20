import type { GoogleGenAI } from "@google/genai";
import { createGeminiClient, planRetry, sleep } from "../gemini/client.js";

export const EMBEDDING_MODEL = "gemini-embedding-2";
/**
 * 768 of the model's 3072 dimensions keeps vectors ~4x smaller (the free M0 cluster caps storage
 * at 512 MB). gemini-embedding-2 re-normalizes truncated vectors itself.
 */
export const EMBEDDING_DIMENSIONS = 768;

const MAX_BATCH_SIZE = 100;

/**
 * gemini-embedding-2 takes the retrieval task as a text prefix instead of a taskType parameter.
 * Documents and questions use different prefixes and must match at query time.
 */
export function formatDocumentForEmbedding(title: string, text: string): string {
  return `title: ${title} | text: ${text}`;
}

export function formatQueryForEmbedding(question: string): string {
  return `task: search result | query: ${question}`;
}

export class GeminiEmbedder {
  private readonly ai: GoogleGenAI;
  /** Shrinks after a token-per-minute rate limit so each request fits the quota. */
  private batchSize = MAX_BATCH_SIZE;

  constructor(apiKey: string) {
    this.ai = createGeminiClient(apiKey);
  }

  /** Embeds texts in order, batching requests and backing off on rate limits and transient errors. */
  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    let retries = 0;
    while (vectors.length < texts.length) {
      const batch = texts.slice(vectors.length, vectors.length + this.batchSize);
      try {
        vectors.push(...(await this.request(batch)));
        retries = 0;
      } catch (error) {
        const plan = planRetry(error, retries, "embedding");
        if (plan.isTokenQuota && this.batchSize > 1) {
          this.batchSize = Math.ceil(this.batchSize / 2);
          console.warn(`[gemini] embedding: retrying with batches of ${this.batchSize}`);
        }
        retries++;
        await sleep(plan.waitSeconds * 1000);
      }
    }
    return vectors;
  }

  /** Embeds a user's question so it can be compared against stored document embeddings. */
  async embedQuery(question: string): Promise<number[]> {
    const [vector] = await this.embed([formatQueryForEmbedding(question)]);
    return vector!;
  }

  private async request(texts: string[]): Promise<number[][]> {
    const response = await this.ai.models.embedContent({
      model: EMBEDDING_MODEL,
      // One Content per text: gemini-embedding-2 treats a plain string[] as parts of a single
      // input and returns just one embedding for all of them.
      contents: texts.map((text) => ({ parts: [{ text }] })),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Gemini returned ${vectors.length} embeddings for ${texts.length} inputs`);
    }
    return vectors;
  }
}
