import type { RepoSummary } from "../types";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");

export const formatCompact = (value: number) => compact.format(value);
export const formatNumber = (value: number) => whole.format(value);

/** Share of a repo's ingested documents that are embedded and searchable. */
export function indexedPercent(repo: RepoSummary): number {
  const { embeddedDocuments, totalDocuments } = repo.stats;
  return totalDocuments === 0 ? 0 : Math.floor((embeddedDocuments / totalDocuments) * 100);
}

export function catalogTotals(repos: RepoSummary[]) {
  return repos.reduce(
    (totals, repo) => ({
      repos: totals.repos + 1,
      chunks: totals.chunks + repo.stats.chunks,
      files: totals.files + repo.stats.files,
      history: totals.history + repo.stats.commits + repo.stats.pullRequests,
    }),
    { repos: 0, chunks: 0, files: 0, history: 0 },
  );
}
