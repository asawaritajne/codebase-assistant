import type { GitHubClient } from "./github.js";
import type { CodeDocument, CommitDocument, PullRequestDocument } from "./types.js";

// GitHub REST response shapes, limited to the fields we read.
interface GhRepo {
  default_branch: string;
}
interface GhBranch {
  commit: { sha: string; commit: { tree: { sha: string } } };
}
interface GhTree {
  truncated: boolean;
  tree: { path: string; type: string; sha: string; size?: number }[];
}
interface GhBlob {
  content: string;
  encoding: string;
}
interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
}
interface GhPull {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  updated_at: string;
  user: { login: string } | null;
}
type GhMergedPull = GhPull & { merged_at: string };

const PAGE_SIZE = 100;

export interface SourceFile {
  path: string;
  sha: string;
  size: number;
}

export interface SourceTree {
  branch: string;
  commitSha: string;
  files: SourceFile[];
  /** Files under the source directories left out as non-code or oversized. */
  skippedFiles: number;
}

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
/** Generated bundles and giant fixtures would cost a lot of embedding quota for little value. */
const MAX_FILE_BYTES = 300_000;

/** Lists the code files under `dirs` on the default branch in a single tree request. */
export async function resolveSourceTree(client: GitHubClient, repo: string, dirs: string[]): Promise<SourceTree> {
  const { default_branch: branch } = await client.get<GhRepo>(`/repos/${repo}`);
  const head = await client.get<GhBranch>(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);
  const tree = await client.get<GhTree>(`/repos/${repo}/git/trees/${head.commit.commit.tree.sha}`, {
    recursive: 1,
  });
  if (tree.truncated) {
    console.warn(`[github] GitHub truncated the file tree for ${repo}; some files may be missing`);
  }

  const inSourceDirs = tree.tree.filter(
    (entry) => entry.type === "blob" && dirs.some((dir) => entry.path.startsWith(`${dir}/`)),
  );
  const files = inSourceDirs
    .filter((entry) => CODE_FILE.test(entry.path) && (entry.size ?? 0) <= MAX_FILE_BYTES)
    .map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size ?? 0 }));

  return { branch, commitSha: head.commit.sha, files, skippedFiles: inSourceDirs.length - files.length };
}

/** Returns null for binary files, which have no text worth embedding. */
export async function fetchCodeDocument(
  client: GitHubClient,
  repo: string,
  commitSha: string,
  file: SourceFile,
): Promise<CodeDocument | null> {
  const blob = await client.get<GhBlob>(`/repos/${repo}/git/blobs/${file.sha}`);
  const bytes = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8");
  if (bytes.includes(0)) return null;

  const urlPath = file.path.split("/").map(encodeURIComponent).join("/");
  return {
    repo,
    type: "code",
    sourceId: file.path,
    sourceUrl: `https://github.com/${repo}/blob/${commitSha}/${urlPath}`,
    content: bytes.toString("utf8"),
    path: file.path,
    blobSha: file.sha,
    commitSha,
    size: file.size,
    ingestedAt: new Date(),
  };
}

/** The most recent `limit` commits on the default branch. */
export async function fetchCommitDocuments(
  client: GitHubClient,
  repo: string,
  limit: number,
): Promise<CommitDocument[]> {
  const commits: GhCommit[] = [];
  for (let page = 1; commits.length < limit; page++) {
    const batch = await client.get<GhCommit[]>(`/repos/${repo}/commits`, { per_page: PAGE_SIZE, page });
    commits.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return commits.slice(0, limit).map((commit) => ({
    repo,
    type: "commit",
    sourceId: commit.sha,
    sourceUrl: commit.html_url,
    content: commit.commit.message,
    sha: commit.sha,
    author: commit.commit.author?.name ?? null,
    committedAt: commit.commit.author ? new Date(commit.commit.author.date) : null,
    ingestedAt: new Date(),
  }));
}

/** The `limit` most recently merged pull requests (closed-but-unmerged PRs are skipped). */
export async function fetchMergedPullRequestDocuments(
  client: GitHubClient,
  repo: string,
  limit: number,
): Promise<PullRequestDocument[]> {
  // GitHub can't sort by merge date, so page through closed PRs by most recent
  // update. A PR's updated_at is always >= its merged_at, so once `limit` merges
  // are newer than the oldest update seen so far, no unseen PR can outrank them.
  const merged = new Map<number, GhMergedPull>();
  for (let page = 1; ; page++) {
    const batch = await client.get<GhPull[]>(`/repos/${repo}/pulls`, {
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: PAGE_SIZE,
      page,
    });
    for (const pr of batch) {
      if (pr.merged_at) merged.set(pr.number, pr as GhMergedPull);
    }

    const oldestUpdate = batch.at(-1)?.updated_at ?? "";
    const settled = [...merged.values()].filter((pr) => pr.merged_at >= oldestUpdate).length;
    if (batch.length < PAGE_SIZE || settled >= limit) break;
  }

  return [...merged.values()]
    .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
    .slice(0, limit)
    .map((pr) => ({
      repo,
      type: "pr",
      sourceId: String(pr.number),
      sourceUrl: pr.html_url,
      content: pr.body ?? "",
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? null,
      mergedAt: new Date(pr.merged_at),
      ingestedAt: new Date(),
    }));
}
