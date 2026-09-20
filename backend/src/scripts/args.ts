import { REPOS, findRepo, type RepoConfig } from "../config/repos.js";

/** Values of a repeatable flag, accepting `--name a --name b`, `--name=a`, and `--name a,b`. */
function flagValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  argv.forEach((arg, index) => {
    if (arg === `--${name}`) values.push(argv[index + 1] ?? "");
    else if (arg.startsWith(`--${name}=`)) values.push(arg.slice(name.length + 3));
  });
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

/** The repos named with --repo, or every configured repo when none are named. */
export function selectRepos(argv: string[]): RepoConfig[] {
  const ids = flagValues(argv, "repo");
  if (ids.length === 0) return REPOS;
  return ids.map((id) => {
    const repo = findRepo(id);
    if (!repo) throw new Error(`Unknown repo "${id}". Known repos: ${REPOS.map((r) => r.id).join(", ")}`);
    return repo;
  });
}

export function numberFlag(argv: string[], name: string, fallback: number): number {
  const [value] = flagValues(argv, name);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`--${name} must be a whole number of 0 or more`);
  return number;
}
