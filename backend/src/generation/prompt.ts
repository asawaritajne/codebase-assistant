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

export function buildAnswerPrompt(repo: string, question: string, chunks: RetrievedChunk[]): string {
  const sources = chunks.map((chunk, index) => {
    const lines = chunk.startLine ? ` (lines ${chunk.startLine}-${chunk.endLine})` : "";
    return `[S${index + 1}] ${chunk.type} | ${chunk.title}${lines} | ${chunk.sourceUrl}\n${chunk.text}`;
  });

  return [
    `Repository: ${repo}`,
    "",
    "Sources:",
    "",
    sources.join("\n\n---\n\n"),
    "",
    `Question: ${question}`,
  ].join("\n");
}
