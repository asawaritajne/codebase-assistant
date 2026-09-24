// Mirrors the backend's GET /repos (backend/src/repos/catalog.ts) and POST /ask (backend/src/qa/ask.ts).

export type RepoIndexStatus = "ready" | "indexing" | "queued" | "not-ingested";

export interface RepoSummary {
  id: string;
  fullName: string;
  name: string;
  category: string;
  description: string;
  githubUrl: string;
  exampleQuestions: string[];
  stars: number | null;
  status: RepoIndexStatus;
  stats: {
    files: number;
    commits: number;
    pullRequests: number;
    chunks: number;
    embeddedDocuments: number;
    totalDocuments: number;
    lastIngestedAt: string | null;
  };
}

export type SourceType = "code" | "commit" | "pr";

/**
 * The 3D projection of every embedded chunk (backend/src/visualization/map.ts). Parallel arrays,
 * not objects, so 6,000+ points arrive in one small payload.
 */
export interface EmbeddingMap {
  repos: { id: string; name: string }[];
  types: SourceType[];
  count: number;
  /** Flat [x, y, z, x, y, z, ...]. */
  positions: number[];
  repoIndex: number[];
  typeIndex: number[];
  isTest: number[];
  titles: string[];
  urls: string[];
  /** Per-point identifiers, used to locate a live query's neighbours. */
  keys: string[];
  builtAt: string | null;
}

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
  cited: boolean;
  text: string;
}

export interface CitationReport {
  valid: boolean;
  citedMarkers: string[];
  invalidMarkers: string[];
  uncitedParagraphs: string[];
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: AnswerSource[];
  citations: CitationReport;
  regenerated: boolean;
  model: string;
  embeddingModel: string;
  retrievalMs: number;
  latencyMs: number;
  /** Id behind this answer's permanent link, or null if it couldn't be recorded. */
  shareId: string | null;
}

/** A stored answer, as shown on /a/<id>. */
export interface SharedAnswer extends Omit<AskResponse, "shareId"> {
  id: string;
  repo: string;
  repoId: string;
  createdAt: string;
}

/** One turn of a conversation, sent with follow-up questions. */
export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface MapQueryNeighbour {
  key: string;
  title: string;
  type: SourceType;
  repo: string;
  sourceUrl: string;
  score: number;
}

/** Where a live question lands in the 3D space, and what it would retrieve. */
export interface MapQueryResult {
  question: string;
  position: [number, number, number];
  neighbours: MapQueryNeighbour[];
}

/** A reader's verdict on one answer. */
export type Rating = "up" | "down";

/** Aggregate answer quality (backend/src/qa/quality.ts), shown on /quality. */
export interface QualityMetrics {
  answers: number;
  since: string | null;
  until: string | null;
  citations: { passed: number; flagged: number; passRate: number };
  regeneration: { count: number; rate: number };
  sources: { retrieved: number; cited: number; citedRate: number };
  latency: { medianMs: number; p95Ms: number; medianRetrievalMs: number };
  feedback: { up: number; down: number; rated: number; helpfulRate: number };
  models: { model: string; answers: number }[];
  repos: { repoId: string; repo: string; answers: number; passRate: number; medianMs: number; up: number; down: number }[];
  daily: { date: string; answers: number; flagged: number }[];
  recent: {
    id: string;
    question: string;
    repoId: string;
    repo: string;
    createdAt: string;
    valid: boolean;
    regenerated: boolean;
    latencyMs: number;
    rating: Rating | null;
  }[];
}
