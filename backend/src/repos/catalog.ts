import type { Db } from "mongodb";
import { REPOS } from "../config/repos.js";
import { EMBEDDED_CHUNKS_COLLECTION } from "../embedding/store.js";
import type { GitHubClient } from "../ingestion/github.js";
import { RAW_INGESTION_COLLECTION } from "../ingestion/store.js";
import type { SourceType } from "../ingestion/types.js";

/** Index stats change only when ingestion or embedding runs, so a short cache is plenty. */
const STATS_TTL_MS = 30_000;
const STARS_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * - ready: every ingested document is embedded and searchable.
 * - indexing: embedding is under way, so the repo is partly searchable.
 * - queued: ingested from GitHub but not embedded yet, so nothing is searchable.
 * - not-ingested: nothing pulled from GitHub yet.
 */
export type RepoIndexStatus = "ready" | "indexing" | "queued" | "not-ingested";

export interface RepoSummary {
  id: string;
  fullName: string;
  name: string;
  category: string;
  description: string;
  githubUrl: string;
  exampleQuestions: string[];
  /** GitHub stars, or null when they couldn't be fetched yet. */
  stars: number | null;
  status: RepoIndexStatus;
  stats: {
    files: number;
    commits: number;
    pullRequests: number;
    /** Searchable chunks in the vector index. */
    chunks: number;
    embeddedDocuments: number;
    totalDocuments: number;
    lastIngestedAt: string | null;
  };
}

interface RawStatsRow {
  _id: { repo: string; type: SourceType };
  documents: number;
  embedded: number;
  lastIngestedAt: Date;
}

/** Describes every configured repository with live indexing stats, for the website. */
export class RepoCatalog {
  private cache?: { at: number; repos: RepoSummary[] };
  private readonly stars = new Map<string, number>();
  private starsFetchedAt = 0;
  private starsRefresh?: Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly github: GitHubClient,
  ) {
    void this.refreshStarsIfStale();
  }

  async list(): Promise<RepoSummary[]> {
    // Stars refresh in the background: a slow or rate-limited GitHub call never delays the page.
    void this.refreshStarsIfStale();
    if (this.cache && Date.now() - this.cache.at < STATS_TTL_MS) return this.cache.repos;

    const fullNames = REPOS.map((repo) => repo.fullName);
    const [rawStats, chunkStats] = await Promise.all([
      this.db
        .collection(RAW_INGESTION_COLLECTION)
        .aggregate<RawStatsRow>([
          { $match: { repo: { $in: fullNames } } },
          {
            $group: {
              _id: { repo: "$repo", type: "$type" },
              documents: { $sum: 1 },
              embedded: { $sum: { $cond: [{ $ifNull: ["$embeddingStatus", false] }, 1, 0] } },
              lastIngestedAt: { $max: "$ingestedAt" },
            },
          },
        ])
        .toArray(),
      this.db
        .collection(EMBEDDED_CHUNKS_COLLECTION)
        .aggregate<{ _id: string; chunks: number }>([
          { $match: { repo: { $in: fullNames } } },
          { $group: { _id: "$repo", chunks: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const repos = REPOS.map((repo): RepoSummary => {
      const rows = rawStats.filter((row) => row._id.repo === repo.fullName);
      const documents = (type: SourceType) => rows.find((row) => row._id.type === type)?.documents ?? 0;
      const totalDocuments = rows.reduce((total, row) => total + row.documents, 0);
      const embeddedDocuments = rows.reduce((total, row) => total + row.embedded, 0);
      const lastIngestedAt = rows.reduce<Date | null>(
        (latest, row) => (!latest || row.lastIngestedAt > latest ? row.lastIngestedAt : latest),
        null,
      );

      return {
        id: repo.id,
        fullName: repo.fullName,
        name: repo.name,
        category: repo.category,
        description: repo.description,
        githubUrl: `https://github.com/${repo.fullName}`,
        exampleQuestions: repo.exampleQuestions,
        stars: this.stars.get(repo.fullName) ?? null,
        status:
          totalDocuments === 0
            ? "not-ingested"
            : embeddedDocuments === 0
              ? "queued"
              : embeddedDocuments >= totalDocuments
                ? "ready"
                : "indexing",
        stats: {
          files: documents("code"),
          commits: documents("commit"),
          pullRequests: documents("pr"),
          chunks: chunkStats.find((row) => row._id === repo.fullName)?.chunks ?? 0,
          embeddedDocuments,
          totalDocuments,
          lastIngestedAt: lastIngestedAt?.toISOString() ?? null,
        },
      };
    });

    this.cache = { at: Date.now(), repos };
    return repos;
  }

  /** Call after ingestion or embedding changes the index. */
  invalidate(): void {
    this.cache = undefined;
  }

  private refreshStarsIfStale(): Promise<void> {
    if (this.starsRefresh || Date.now() - this.starsFetchedAt < STARS_TTL_MS) return this.starsRefresh ?? Promise.resolve();
    this.starsRefresh = (async () => {
      for (const repo of REPOS) {
        try {
          const { stargazers_count: stars } = await this.github.get<{ stargazers_count: number }>(`/repos/${repo.fullName}`);
          this.stars.set(repo.fullName, stars);
        } catch (error) {
          console.warn(`[repos] Couldn't fetch stars for ${repo.fullName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      this.starsFetchedAt = Date.now();
      this.cache = undefined;
      this.starsRefresh = undefined;
    })();
    return this.starsRefresh;
  }
}
