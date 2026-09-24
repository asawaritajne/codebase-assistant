import type { RetrievedChunk } from "../retrieval/search.js";

/**
 * The grounding rules. Answers must come from the retrieved sources alone, so the model can't fall
 * back on what it happens to remember about the library.
 */
export const ANSWER_SYSTEM_INSTRUCTION = [
  "You are a codebase assistant. You answer questions about one open-source repository using only the numbered sources supplied with each question.",
  "",
  "Rules:",
  "- Use ONLY the provided sources. Never rely on prior knowledge of the library, and never invent code, APIs, file names, or behaviour.",
  "- Cite every factual claim with its source marker, e.g. [S1] or [S2][S3].",
  "- If the sources don't contain enough information to answer, say so plainly, name what is missing, and cite the sources you checked. Do not guess.",
  "- When sources disagree, prefer source code over tests, commits, and pull requests; note when a commit or PR explains why something changed.",
  "- Be concise and concrete. Use short paragraphs or bullets, and quote small snippets from the sources where they help.",
].join("\n");

export interface ConversationTurn {
  question: string;
  answer: string;
}

/** Earlier answers are summarised down to this, enough for follow-ups without crowding the sources. */
const HISTORY_ANSWER_CHARS = 600;

export function buildAnswerPrompt(
  repo: string,
  question: string,
  chunks: RetrievedChunk[],
  history: ConversationTurn[] = [],
): string {
  const sources = chunks.map((chunk, index) => {
    const lines = chunk.startLine ? ` (lines ${chunk.startLine}-${chunk.endLine})` : "";
    return `[S${index + 1}] ${chunk.type} | ${chunk.title}${lines} | ${chunk.sourceUrl}\n${chunk.text}`;
  });

  const earlier = history.map(
    (turn, index) =>
      `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer.slice(0, HISTORY_ANSWER_CHARS)}${
        turn.answer.length > HISTORY_ANSWER_CHARS ? "…" : ""
      }`,
  );

  return [
    `Repository: ${repo}`,
    "",
    ...(earlier.length > 0
      ? [
          "Earlier in this conversation (context only — never cite it as a source):",
          "",
          earlier.join("\n\n"),
          "",
        ]
      : []),
    "Sources:",
    "",
    sources.join("\n\n---\n\n"),
    "",
    history.length > 0
      ? `Follow-up question (it may refer back to the conversation above): ${question}`
      : `Question: ${question}`,
  ].join("\n");
}
