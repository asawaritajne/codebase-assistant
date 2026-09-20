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
}
