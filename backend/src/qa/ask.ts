import type { Db } from "mongodb";
import { withMongoRetry } from "../db/mongo.js";
import { EMBEDDING_MODEL, type GeminiEmbedder } from "../embedding/gemini.js";
import { GENERATION_MODEL, type GeminiGenerator } from "../generation/gemini.js";
import { ANSWER_SYSTEM_INSTRUCTION, buildAnswerPrompt } from "../generation/prompt.js";
import type { SourceType } from "../ingestion/types.js";
import { retrieveRelevantChunks, type RetrievedChunk } from "../retrieval/search.js";
import { checkCitations, needsRegeneration, type CitationReport } from "./citations.js";

export const QUERY_HISTORY_COLLECTION = "query_history";
export const DEFAULT_SOURCE_LIMIT = 5;

const NO_SOURCES_ANSWER =
  "I couldn't find anything relevant in the indexed sources for this repository, so I can't answer that question. Try rephrasing it, or check that the ingestion and embedding steps have run.";

export type AnswerGenerator = Pick<GeminiGenerator, "generate">;

export interface AnswerSource {
  /** Matches the [S1]-style citations in the answer text. */
  marker: string;
  type: SourceType;
  title: string;
  sourceUrl: string;
  startLine?: number;
  endLine?: number;
  isTest: boolean;
  score: number;
  /** Whether the answer actually cites this source. */
  cited: boolean;
  /** The exact chunk text the answer was allowed to use. */
  text: string;
}

export interface AskResult {
  question: string;
  answer: string;
  sources: AnswerSource[];
  citations: CitationReport;
  /** True when the first answer failed the citation check and was generated again. */
  regenerated: boolean;
  model: string;
  embeddingModel: string;
  retrievalMs: number;
  latencyMs: number;
}

export interface AskOptions {
  question: string;
  /** Repository ("owner/name") whose chunks are searched; also named in the prompt. */
  repo: string;
  limit?: number;
  /** Optional Atlas pre-filter, e.g. { isTest: false }. */
  filter?: Record<string, unknown>;
}

export interface GroundedAnswer {
  answer: string;
  citations: CitationReport;
  regenerated: boolean;
}

/**
 * Generates an answer and checks its citations. An answer citing a source that doesn't exist, or
 * citing nothing, is generated once more with the problem spelled out; if the second attempt still
 * fails, it is returned with its failing report so the caller can warn the reader.
 */
export async function generateGroundedAnswer(
  generator: AnswerGenerator,
  repo: string,
  question: string,
  chunks: RetrievedChunk[],
): Promise<GroundedAnswer> {
  const prompt = buildAnswerPrompt(repo, question, chunks);
  const answer = await generator.generate(ANSWER_SYSTEM_INSTRUCTION, prompt);
  const citations = checkCitations(answer, chunks.length);
  if (!needsRegeneration(citations)) return { answer, citations, regenerated: false };

  const problem =
    citations.invalidMarkers.length > 0
      ? `it cited sources that don't exist (${citations.invalidMarkers.join(", ")}); only S1 to S${chunks.length} exist`
      : "it didn't cite any sources";
  console.warn(`[ask] Answer failed the citation check (${problem}); generating it again`);

  const retryPrompt = `${prompt}\n\nImportant: a previous answer to this question was rejected because ${problem}. Answer again, citing every claim with the markers of the sources above.`;
  const retryAnswer = await generator.generate(ANSWER_SYSTEM_INSTRUCTION, retryPrompt);
  return { answer: retryAnswer, citations: checkCitations(retryAnswer, chunks.length), regenerated: true };
}

/**
 * The RAG pipeline: embed the question, retrieve the closest chunks, and let Gemini answer using
 * only those chunks. Every answer carries the sources it was built from and a citation report.
 */
export async function answerQuestion(
  db: Db,
  embedder: GeminiEmbedder,
  generator: AnswerGenerator,
  { question, repo, limit = DEFAULT_SOURCE_LIMIT, filter }: AskOptions,
): Promise<AskResult> {
  const startedAt = Date.now();
  const queryVector = await embedder.embedQuery(question);

  const retrievalStartedAt = Date.now();
  const chunks = await retrieveRelevantChunks(db, queryVector, { limit, filter: { repo, ...filter } });
  const retrievalMs = Date.now() - retrievalStartedAt;

  const grounded: GroundedAnswer =
    chunks.length === 0
      ? // The fallback message makes no claims about the code, so there is nothing to cite.
        {
          answer: NO_SOURCES_ANSWER,
          citations: { valid: true, citedMarkers: [], invalidMarkers: [], uncitedParagraphs: [] },
          regenerated: false,
        }
      : await generateGroundedAnswer(generator, repo, question, chunks);

  const result: AskResult = {
    question,
    ...grounded,
    sources: chunks.map((chunk, index) => {
      const marker = `S${index + 1}`;
      const { type, title, sourceUrl, startLine, endLine, isTest, score, text } = chunk;
      const cited = grounded.citations.citedMarkers.includes(marker);
      return { marker, type, title, sourceUrl, startLine, endLine, isTest, score, cited, text };
    }),
    model: GENERATION_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    retrievalMs,
    latencyMs: Date.now() - startedAt,
  };

  const citationStatus = result.citations.valid ? "citations ok" : "citations flagged";
  console.log(
    `[ask] ${JSON.stringify(question)} -> ${chunks.length} sources, ${citationStatus}` +
      `${result.regenerated ? " after regenerating" : ""}, ${result.latencyMs}ms`,
  );

  await recordQuery(db, result);
  return result;
}

/** Keeps a log of questions and answers for reviewing answer quality later. */
async function recordQuery(db: Db, result: AskResult): Promise<void> {
  try {
    await withMongoRetry("Recording query history", async () => {
      await db.collection(QUERY_HISTORY_COLLECTION).insertOne({
        question: result.question,
        answer: result.answer,
        // Chunk text is already in embedded_chunks; the history keeps just the references.
        sources: result.sources.map(({ marker, type, title, sourceUrl, score, cited }) => ({
          marker,
          type,
          title,
          sourceUrl,
          score,
          cited,
        })),
        citations: result.citations,
        regenerated: result.regenerated,
        model: result.model,
        embeddingModel: result.embeddingModel,
        retrievalMs: result.retrievalMs,
        latencyMs: result.latencyMs,
        createdAt: new Date(),
      });
    });
  } catch (error) {
    // History is a nicety; never fail a good answer because logging it didn't work.
    console.warn(`[ask] Could not record query history: ${error instanceof Error ? error.message : String(error)}`);
  }
}
