import type { RawDocument } from "../ingestion/types.js";

/** Bump whenever chunking output changes, so already-embedded documents get re-embedded. */
export const CHUNKER_VERSION = 1;

/** Rough average for TypeScript and English prose; exact counts would cost an API call per chunk. */
const CHARS_PER_TOKEN = 3.5;
const MAX_CHUNK_TOKENS = 500;
/** Chunks smaller than this (e.g. a trailing `});`) are folded into the previous chunk. */
const MIN_CHUNK_TOKENS = 50;

/** Test directories (`__tests__/`, `test/`, `tests/`, `spec/`, ...) or `*.test.*` / `*.spec.*` files. */
const TEST_FILE = /(^|\/)(__tests__|__typetest__|__mocks__|tests?|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
/** Lines that close a block rather than start one. */
const CLOSING_LINE = /^([)\]}]|<\/)/;
/** Comments and decorators belong with the code line that follows them. */
const LEADING_LINE = /^(\/\/|\/\*|\*|@)/;

export interface DocumentChunk {
  /** File path, commit subject, or PR title. */
  title: string;
  text: string;
  sourceUrl: string;
  /** 1-based line range within the file (code chunks only). */
  startLine?: number;
  endLine?: number;
  isTest: boolean;
}

interface TextSpan {
  text: string;
  startLine: number;
  endLine: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function chunkRawDocument(doc: RawDocument): DocumentChunk[] {
  switch (doc.type) {
    case "code": {
      // Jest snapshots are generated render output: bulky and noisy for retrieval.
      if (doc.path.endsWith(".snap")) return [];
      const isTest = TEST_FILE.test(doc.path);
      return splitText(doc.content, "code").map(({ text, startLine, endLine }) => ({
        title: doc.path,
        text,
        sourceUrl: `${doc.sourceUrl}#L${startLine}-L${endLine}`,
        startLine,
        endLine,
        isTest,
      }));
    }
    case "commit": {
      const title = doc.content.split("\n", 1)[0]?.trim() || doc.sha.slice(0, 7);
      return splitText(doc.content, "prose").map(({ text }) => ({
        title,
        text,
        sourceUrl: doc.sourceUrl,
        isTest: false,
      }));
    }
    case "pr": {
      // Strip leftover PR-template comments; a PR without a description is still findable by its title.
      const body = doc.content.replace(/<!--[\s\S]*?-->/g, "").trim() || doc.title;
      return splitText(body, "prose").map(({ text }) => ({
        title: `#${doc.number} ${doc.title}`,
        text,
        sourceUrl: doc.sourceUrl,
        isTest: false,
      }));
    }
  }
}

/**
 * Splits text into chunks of at most ~MAX_CHUNK_TOKENS, cutting only between lines. Oversized
 * spans are split recursively at structural boundaries (code blocks or paragraphs), falling back
 * to single lines, then adjacent pieces are packed back together up to the limit.
 */
function splitText(content: string, mode: "code" | "prose"): TextSpan[] {
  const lines = content.split("\n");
  const offsets = [0]; // offsets[i] = characters before line i, newlines included
  for (const line of lines) offsets.push(offsets.at(-1)! + line.length + 1);
  const tokensIn = (start: number, end: number) => (offsets[end]! - offsets[start]!) / CHARS_PER_TOKEN;
  const isBlank = (i: number) => lines[i]!.trim() === "";

  const followsLeadingLine = (i: number) => {
    let prev = i - 1;
    while (prev >= 0 && isBlank(prev)) prev--;
    return prev >= 0 && LEADING_LINE.test(lines[prev]!.trimStart());
  };

  // Code: lines at the shallowest indentation within the span start new blocks, i.e. top-level
  // declarations in a file, or statements and test cases inside a function or describe(). The
  // span's own first line and closing lines are ignored, so a block splits between its children.
  const codeBoundaries = (start: number, end: number): number[] => {
    const openers: { line: number; indent: number }[] = [];
    for (let i = start + 1; i < end; i++) {
      const trimmed = lines[i]!.trimStart();
      if (trimmed !== "" && !CLOSING_LINE.test(trimmed)) {
        openers.push({ line: i, indent: lines[i]!.length - trimmed.length });
      }
    }
    const minIndent = openers.reduce((min, opener) => Math.min(min, opener.indent), Infinity);
    return openers
      .filter((opener) => opener.indent === minIndent && !followsLeadingLine(opener.line))
      .map((opener) => opener.line);
  };

  // Prose: paragraph starts, i.e. non-blank lines that follow a blank line.
  const proseBoundaries = (start: number, end: number): number[] => {
    const starts: number[] = [];
    for (let i = start + 1; i < end; i++) {
      if (!isBlank(i) && isBlank(i - 1)) starts.push(i);
    }
    return starts;
  };

  const findBoundaries = mode === "code" ? codeBoundaries : proseBoundaries;

  const split = (start: number, end: number): [number, number][] => {
    if (end - start <= 1 || tokensIn(start, end) <= MAX_CHUNK_TOKENS) return [[start, end]];
    let cuts = findBoundaries(start, end);
    if (cuts.length === 0) cuts = Array.from({ length: end - start - 1 }, (_, i) => start + 1 + i);
    return [start, ...cuts].flatMap((cut, i) => split(cut, cuts[i] ?? end));
  };

  const packed: [number, number][] = [];
  for (const [start, end] of split(0, lines.length)) {
    const last = packed.at(-1);
    if (last && tokensIn(last[0], end) <= MAX_CHUNK_TOKENS) last[1] = end;
    else packed.push([start, end]);
  }

  const folded: [number, number][] = [];
  for (const [start, end] of packed) {
    const last = folded.at(-1);
    if (last && tokensIn(start, end) < MIN_CHUNK_TOKENS) last[1] = end;
    else folded.push([start, end]);
  }

  return folded.flatMap(([start, end]) => {
    while (start < end && isBlank(start)) start++;
    while (end > start && isBlank(end - 1)) end--;
    return start < end ? [{ text: lines.slice(start, end).join("\n"), startLine: start + 1, endLine: end }] : [];
  });
}
