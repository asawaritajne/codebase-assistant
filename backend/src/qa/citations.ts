/** A citation group such as [S1], [S2, S3] or [S1; S4]. */
const CITATION_GROUP = /\[\s*S\d+(?:\s*[,;]\s*S?\d+)*\s*\]/g;
const LIST_ITEM = /^([-*+]|\d+[.)])\s/;
const HEADING = /^#{1,6}\s/;
const HORIZONTAL_RULE = /^([-*_])\1{2,}$/;
/** A fully bold line like "**Unmounted fields**"; a bold sentence ending in . ! or ? isn't a label. */
const BOLD_LABEL = /^\*\*[^*]*[^*.!?]\*\*:?$/;
const MAX_REPORTED_TEXT = 200;

export interface CitationReport {
  /** True when every marker points at a retrieved source and every statement cites one. */
  valid: boolean;
  /** Markers that match a retrieved source, e.g. ["S1", "S3"]. */
  citedMarkers: string[];
  /** Markers with no matching source, e.g. ["S7"] when only five sources were retrieved. */
  invalidMarkers: string[];
  /** Paragraphs or list items that state something without citing a source. */
  uncitedParagraphs: string[];
}

const markerNumber = (marker: string) => Number(marker.slice(1));

/** Every source marker in the text, in order, with duplicates. */
export function extractMarkers(text: string): string[] {
  return [...text.matchAll(CITATION_GROUP)].flatMap(([group]) =>
    (group.match(/\d+/g) ?? []).map((digits) => `S${Number(digits)}`),
  );
}

/**
 * Splits a Markdown answer into the units that should each carry a citation: paragraphs and list
 * items. Code blocks, headings, and rules state nothing on their own, so they are left out.
 */
function statements(answer: string): string[] {
  const units: string[] = [];
  let paragraph: string[] = [];
  let inCodeBlock = false;
  const flush = () => {
    if (paragraph.length > 0) units.push(paragraph.join(" "));
    paragraph = [];
  };

  for (const rawLine of answer.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      flush();
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      continue;
    } else if (line === "" || HEADING.test(line) || HORIZONTAL_RULE.test(line) || line.startsWith("|")) {
      flush();
    } else if (LIST_ITEM.test(line)) {
      flush();
      units.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();

  return units.filter((unit) => !isLabel(unit));
}

/**
 * Lead-ins ("It works in two steps:") and bold labels ("**Unmounted fields**", or a numbered
 * "1. **Comparing values:**") introduce cited content rather than making claims themselves.
 */
function isLabel(unit: string): boolean {
  const withoutListMarker = unit.replace(LIST_ITEM, "");
  return withoutListMarker.replace(/[*_`]/g, "").trim().endsWith(":") || BOLD_LABEL.test(withoutListMarker);
}

export function checkCitations(answer: string, sourceCount: number): CitationReport {
  const unique = [...new Set(extractMarkers(answer))].sort((a, b) => markerNumber(a) - markerNumber(b));
  const exists = (marker: string) => markerNumber(marker) >= 1 && markerNumber(marker) <= sourceCount;
  const citedMarkers = unique.filter(exists);
  const invalidMarkers = unique.filter((marker) => !exists(marker));
  const uncitedParagraphs = statements(answer)
    .filter((unit) => extractMarkers(unit).length === 0)
    .map((unit) => unit.slice(0, MAX_REPORTED_TEXT));

  return {
    valid: invalidMarkers.length === 0 && citedMarkers.length > 0 && uncitedParagraphs.length === 0,
    citedMarkers,
    invalidMarkers,
    uncitedParagraphs,
  };
}

/**
 * Citing a source that doesn't exist, or nothing at all, is worth a second attempt. A few uncited
 * sentences are only reported: the check is a heuristic, and a retry would rarely be better.
 */
export function needsRegeneration(report: CitationReport): boolean {
  return report.invalidMarkers.length > 0 || report.citedMarkers.length === 0;
}
