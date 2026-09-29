import type { Db, Document, ObjectId } from "mongodb";
import { REPOS } from "../config/repos.js";
import { withMongoRetry } from "../db/mongo.js";
import { EMBEDDED_CHUNKS_COLLECTION } from "../embedding/store.js";
import type { SourceType } from "../ingestion/types.js";
import { projectTo3D, type Point3D, type ProjectionBasis } from "./projection.js";

export const EMBEDDING_MAP_COLLECTION = "embedding_map";
const BASIS_COLLECTION = "embedding_map_basis";

/** Identifies a chunk across the map payload and live query results. */
export const chunkKey = (repo: string, sourceId: string, chunkIndex: number) => `${repo}|${sourceId}|${chunkIndex}`;

export interface MapPoint {
  key: string;
  repo: string;
  type: SourceType;
  isTest: boolean;
  title: string;
  sourceUrl: string;
  position: Point3D;
}

/**
 * The map as the website consumes it: parallel arrays rather than objects, which keeps the payload
 * small enough to send in one request and maps straight onto typed arrays in the browser.
 */
export interface EmbeddingMap {
  repos: { id: string; name: string }[];
  types: SourceType[];
  count: number;
  /** Flat [x, y, z, x, y, z, ...] positions. */
  positions: number[];
  repoIndex: number[];
  typeIndex: number[];
  isTest: number[];
  titles: string[];
  urls: string[];
  /** Per-point identifiers, so a live query's neighbours can be located in this array. */
  keys: string[];
  builtAt: string | null;
}

const TYPES: SourceType[] = ["code", "commit", "pr"];
/** Roughly 11 MB of embeddings per page — small enough to finish well inside any monitor timeout. */
const MAP_PAGE_SIZE = 1000;

/**
 * Chunks a page at a time, walking `_id` rather than holding one cursor open.
 *
 * Every embedding at once is over 100 MB, and a read that large outlives the driver's server
 * monitor on the free cluster: it failed two nights running, and because each retry repeated the
 * same doomed read the third attempt was still going half an hour later. A page is a bounded
 * amount of work, and a retry re-reads only that page instead of starting again.
 */
async function* readChunkPages(db: Db): AsyncGenerator<Document[]> {
  let after: ObjectId | undefined;
  while (true) {
    const filter = after ? { _id: { $gt: after } } : {};
    const page: Document[] = await withMongoRetry(`Reading embeddings for the map${after ? " (resuming)" : ""}`, () =>
      db
        .collection(EMBEDDED_CHUNKS_COLLECTION)
        .find(filter, {
          projection: { embedding: 1, repo: 1, type: 1, isTest: 1, title: 1, sourceUrl: 1, sourceId: 1, chunkIndex: 1 },
        })
        .sort({ _id: 1 })
        .limit(MAP_PAGE_SIZE)
        .toArray(),
    );
    if (page.length === 0) return;
    yield page;
    after = page.at(-1)!._id as ObjectId;
  }
}

/** Recomputes the projection from every embedded chunk and replaces the stored map. */
export async function buildEmbeddingMap(db: Db): Promise<number> {
  const chunks: Document[] = [];
  for await (const page of readChunkPages(db)) chunks.push(...page);
  if (chunks.length === 0) return 0;

  const { points: positions, basis } = projectTo3D(chunks.map((chunk) => chunk.embedding as number[]));
  const points: MapPoint[] = chunks.map((chunk, index) => ({
    key: chunkKey(chunk.repo as string, chunk.sourceId as string, (chunk.chunkIndex as number) ?? 0),
    repo: chunk.repo as string,
    type: chunk.type as SourceType,
    isTest: Boolean(chunk.isTest),
    title: chunk.title as string,
    sourceUrl: chunk.sourceUrl as string,
    position: positions[index]!,
  }));

  const builtAt = new Date();
  const collection = db.collection<MapPoint & { builtAt: Date }>(EMBEDDING_MAP_COLLECTION);
  await withMongoRetry("Replacing the stored map", async () => {
    await collection.deleteMany({});
    await collection.insertMany(points.map((point) => ({ ...point, builtAt })));
  });

  // The basis lets a live question be placed in the same space without redoing the projection.
  await withMongoRetry("Storing the projection basis", () =>
    db
      .collection(BASIS_COLLECTION)
      .replaceOne({ _id: "current" as never }, { ...basis, builtAt, points: points.length }, { upsert: true }),
  );

  return points.length;
}

export async function readProjectionBasis(db: Db): Promise<ProjectionBasis | null> {
  const stored = await db.collection(BASIS_COLLECTION).findOne({ _id: "current" as never });
  if (!stored) return null;
  return {
    mean: stored.mean as number[],
    components: stored.components as number[][],
    scales: stored.scales as [number, number, number],
  };
}

export async function readEmbeddingMap(db: Db): Promise<EmbeddingMap> {
  const stored = await db
    .collection<MapPoint & { builtAt: Date }>(EMBEDDING_MAP_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .toArray();

  const repos = REPOS.filter((repo) => stored.some((point) => point.repo === repo.fullName)).map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
  }));
  const repoOrder = new Map(repos.map((repo, index) => [repo.fullName, index]));

  const map: EmbeddingMap = {
    repos: repos.map(({ id, name }) => ({ id, name })),
    types: TYPES,
    count: stored.length,
    positions: [],
    repoIndex: [],
    typeIndex: [],
    isTest: [],
    titles: [],
    urls: [],
    keys: [],
    builtAt: stored[0]?.builtAt?.toISOString() ?? null,
  };

  for (const point of stored) {
    map.positions.push(...point.position);
    map.repoIndex.push(repoOrder.get(point.repo) ?? 0);
    map.typeIndex.push(Math.max(0, TYPES.indexOf(point.type)));
    map.isTest.push(point.isTest ? 1 : 0);
    map.titles.push(point.title);
    map.urls.push(point.sourceUrl);
    map.keys.push(point.key);
  }
  return map;
}
