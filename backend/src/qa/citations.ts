/** A citation group such as [S1], [S2, S3] or [S1; S4]. */
const CITATION_GROUP = /\[\s*S\d+(?:\s*[,;]\s*S?\d+)*\s*\]/g;
const LIST_ITEM = /^([-*+]|\d+[.)])\s/;
const HEADING = /^#{1,6}\s/;
const HORIZONTAL_RULE = /^([-*_])\1{2,}$/;
/** A fully bold line like "**Unmounted fields**"; a bold sentence ending in . ! or ? isn't a label. */
const BOLD_LABEL = /^\*\*[^*]*[^*.!?]\*\*:?$/;
const MAX_REPORTED_TEXT = 200;
/** Longest a list item can be and still read as an entry in a list rather than a claim. */
const FRAGMENT_MAX_WORDS = 12;
/** Ways of saying the sources do not answer the question. */
const ABSENCE =
  /\b(no information|nothing (?:in|about)|(?:do|does|did)(?: n[o']t| not)\s+(?:contain|include|mention|explain|specify|cover|describe)|not (?:contained|included|mentioned|explained|specified|covered|described)|cannot be determined|can(?:'|no)t be determined|silent on)\b/i;
/** Only an absence that is about the sources themselves, not an absence in the code being described. */
const ABOUT_SOURCES = /\b(sources?|provided|retrieved|excerpts?|indexed)\b/i;

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
 * A list item that enumerates rather than claims: "`maxLength`", "`pattern`". It carries no
 * citation of its own because it makes no statement of its own — the sentence introducing the list
 * does. Anything long enough to assert something, or punctuated as a sentence, is not one of these.
 */
function isFragment(unit: string): boolean {
  const text = unit.replace(LIST_ITEM, "").trim();
  if (/[.!?]$/.test(text)) return false;
  return text.split(/\s+/).filter(Boolean).length <= FRAGMENT_MAX_WORDS;
}

/**
 * Splits a Markdown answer into the units that should each carry a citation: paragraphs and list
 * items. Code blocks, headings, and rules state nothing on their own, so they are left out.
 *
 * An enumeration under a lead-in that cites a source is covered by that citation: "it has any of
 * the following rules [S3]:" followed by the rules themselves. Requiring a marker on every one of
 * those bullets reported seven uncited statements in an answer that was properly cited, which
 * makes the warning meaningless exactly where it is supposed to carry weight.
 */
function statements(answer: string): string[] {
  const units: string[] = [];
  let paragraph: string[] = [];
  let inCodeBlock = false;
  /** Whether the lead-in governing the current list cited a source. */
  let leadInCited = false;
  const flush = () => {
    if (paragraph.length > 0) {
      const unit = paragraph.join(" ");
      units.push(unit);
      // A lead-in ends in a colon; anything else ends the list it would have governed.
      leadInCited = isLabel(unit) && extractMarkers(unit).length > 0;
    }
    paragraph = [];
  };

  for (const rawLine of answer.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      flush();
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      continue;
    } else if (HEADING.test(line) || HORIZONTAL_RULE.test(line) || line.startsWith("|")) {
      flush();
      leadInCited = false;
    } else if (line === "") {
      // A blank line separates a lead-in from its list, so it does not end one.
      flush();
    } else if (LIST_ITEM.test(line)) {
      flush();
      if (!(leadInCited && isFragment(line))) units.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();

  return units.filter((unit) => !isLabel(unit) && !isGapStatement(unit));
}

/**
 * "The sources don't explain why this was added." Such a statement makes no claim about the
 * repository, so there is nothing to cite — and the answer prompt asks for exactly this rather
 * than a guess. Flagging it told the reader an honest answer could not be traced, and counted
 * against the citation pass rate the evaluation page publishes.
 */
function isGapStatement(unit: string): boolean {
  return ABSENCE.test(unit) && ABOUT_SOURCES.test(unit);
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
