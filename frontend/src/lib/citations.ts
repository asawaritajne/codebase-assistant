/** A citation group such as [S1], [S2, S3] or [S1; S4]; same pattern as the backend's check. */
const CITATION_GROUP = /\[\s*S\d+(?:\s*[,;]\s*S?\d+)*\s*\]/g;
const CODE_FENCE = /(```[\s\S]*?```)/;

export const CITATION_HREF_PREFIX = "#cite-";

/**
 * Rewrites citation markers as Markdown links (`[S1](#cite-S1)`), which the answer renderer turns
 * into chips. Grouped markers become one link each, and fenced code blocks are left untouched.
 */
export function linkCitations(markdown: string): string {
  return markdown
    .split(CODE_FENCE)
    .map((segment, index) =>
      // split() with a capture group puts the fenced blocks at odd indexes.
      index % 2 === 1
        ? segment
        : segment.replace(CITATION_GROUP, (group) =>
            (group.match(/\d+/g) ?? []).map((digits) => `[S${Number(digits)}](${CITATION_HREF_PREFIX}S${Number(digits)})`).join(""),
          ),
    )
    .join("");
}
