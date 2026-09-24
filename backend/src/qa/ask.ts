import type { Db } from "mongodb";
import { EMBEDDING_MODEL, type GeminiEmbedder } from "../embedding/gemini.js";
import type { GeminiGenerator } from "../generation/gemini.js";
import { ANSWER_SYSTEM_INSTRUCTION, buildAnswerPrompt, type ConversationTurn } from "../generation/prompt.js";
import type { SourceType } from "../ingestion/types.js";
import { retrieveRelevantChunks, type RetrievedChunk } from "../retrieval/search.js";
import { checkCitations, needsRegeneration, type CitationReport } from "./citations.js";
import { recordQuery } from "./history.js";

export const DEFAULT_SOURCE_LIMIT = 5;
/**
 * Slots of the five reserved for implementation rather than tests. The retrieval benchmark found
 * questions where all five retrieved chunks were test files, leaving the answer with no
 * implementation to cite (see backend/src/eval/dataset.ts).
 */
export const NON_TEST_FLOOR = 3;
/** Older turns add little and cost prompt space, so only the most recent ones are carried. */
export const MAX_HISTORY_TURNS = 3;

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
  /** Id of the stored answer, for its permanent link; null if it couldn't be recorded. */
  shareId: string | null;
}

export interface AskOptions {
  question: string;
  /** Repository ("owner/name") whose chunks are searched; also named in the prompt. */
  repo: string;
  /** Repository id, stored with the answer so a shared link knows where it came from. */
  repoId: string;
  /** Earlier turns of this conversation, oldest first. */
  history?: ConversationTurn[];
  limit?: number;
  /** Optional Atlas pre-filter, e.g. { isTest: false }. */
  filter?: Record<string, unknown>;
}

export interface GroundedAnswer {
  answer: string;
  citations: CitationReport;
  regenerated: boolean;
  /** The Gemini model that produced the answer. */
  model: string;
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
  history: ConversationTurn[] = [],
): Promise<GroundedAnswer> {
  const prompt = buildAnswerPrompt(repo, question, chunks, history);
  const { text: answer, model } = await generator.generate(ANSWER_SYSTEM_INSTRUCTION, prompt);
  const citations = checkCitations(answer, chunks.length);
  if (!needsRegeneration(citations)) return { answer, citations, regenerated: false, model };

  const problem =
    citations.invalidMarkers.length > 0
      ? `it cited sources that don't exist (${citations.invalidMarkers.join(", ")}); only S1 to S${chunks.length} exist`
      : "it didn't cite any sources";
  console.warn(`[ask] Answer failed the citation check (${problem}); generating it again`);

  const retryPrompt = `${prompt}\n\nImportant: a previous answer to this question was rejected because ${problem}. Answer again, citing every claim with the markers of the sources above.`;
  const retry = await generator.generate(ANSWER_SYSTEM_INSTRUCTION, retryPrompt);
  return {
    answer: retry.text,
    citations: checkCitations(retry.text, chunks.length),
    regenerated: true,
    model: retry.model,
  };
}

/**
 * The RAG pipeline: embed the question, retrieve the closest chunks, and let Gemini answer using
 * only those chunks. Every answer carries the sources it was built from and a citation report.
 */
export async function answerQuestion(
  db: Db,
  embedder: GeminiEmbedder,
  generator: AnswerGenerator,
  { question, repo, repoId, history = [], limit = DEFAULT_SOURCE_LIMIT, filter }: AskOptions,
): Promise<AskResult> {
  const startedAt = Date.now();
  const recent = history.slice(-MAX_HISTORY_TURNS);

  // A follow-up like "and what about caching?" is meaningless on its own, so the previous question
  // rides along when searching — no extra model call, which keeps the free quota for answers.
  const previous = recent.at(-1)?.question;
  const retrievalText = previous ? `${previous} ${question}` : question;
  const queryVector = await embedder.embedQuery(retrievalText);

  const retrievalStartedAt = Date.now();
  const chunks = await retrieveRelevantChunks(db, queryVector, {
    limit,
    filter: { repo, ...filter },
    minNonTest: NON_TEST_FLOOR,
  });
  const retrievalMs = Date.now() - retrievalStartedAt;

  const grounded: GroundedAnswer =
    chunks.length === 0
      ? // The fallback message makes no claims about the code, so there is nothing to cite.
        {
          answer: NO_SOURCES_ANSWER,
          citations: { valid: true, citedMarkers: [], invalidMarkers: [], uncitedParagraphs: [] },
          regenerated: false,
          model: "none",
        }
      : await generateGroundedAnswer(generator, repo, question, chunks, recent);

  const result: Omit<AskResult, "shareId"> = {
    question,
    ...grounded,
    sources: chunks.map((chunk, index) => {
      const marker = `S${index + 1}`;
      const { type, title, sourceUrl, startLine, endLine, isTest, score, text } = chunk;
      const cited = grounded.citations.citedMarkers.includes(marker);
      return { marker, type, title, sourceUrl, startLine, endLine, isTest, score, cited, text };
    }),
    embeddingModel: EMBEDDING_MODEL,
    retrievalMs,
    latencyMs: Date.now() - startedAt,
  };

  const citationStatus = result.citations.valid ? "citations ok" : "citations flagged";
  console.log(
    `[ask] ${JSON.stringify(question)}${recent.length > 0 ? ` (follow-up, ${recent.length} prior)` : ""} -> ` +
      `${chunks.length} sources, ${citationStatus}${result.regenerated ? " after regenerating" : ""}, ${result.latencyMs}ms`,
  );

  return { ...result, shareId: await recordQuery(db, repoId, repo, result) };
}
