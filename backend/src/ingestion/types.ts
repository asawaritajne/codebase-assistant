export type SourceType = "code" | "commit" | "pr";

export interface IngestionOptions {
  /** Target repository as "owner/name". */
  repo: string;
  /** Code files under these directories are ingested, test files included. */
  sourceDirs: string[];
  commitLimit: number;
  pullRequestLimit: number;
}

interface RawDocumentBase {
  repo: string;
  type: SourceType;
  /** File path, commit SHA, or PR number — unique per repo + type. */
  sourceId: string;
  /** Link back to GitHub, used later for citations. */
  sourceUrl: string;
  /** The raw, unmodified text: file contents, commit message, or PR description. */
  content: string;
  ingestedAt: Date;
}

export interface CodeDocument extends RawDocumentBase {
  type: "code";
  path: string;
  blobSha: string;
  /** Commit the file was read at; sourceUrl is a permalink to this commit. */
  commitSha: string;
  size: number;
}

export interface CommitDocument extends RawDocumentBase {
  type: "commit";
  sha: string;
  author: string | null;
  committedAt: Date | null;
}

export interface PullRequestDocument extends RawDocumentBase {
  type: "pr";
  number: number;
  title: string;
  author: string | null;
  mergedAt: Date;
}

export type RawDocument = CodeDocument | CommitDocument | PullRequestDocument;
