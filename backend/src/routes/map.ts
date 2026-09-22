import { Router } from "express";
import type { Db } from "mongodb";
import { readEmbeddingMap, type EmbeddingMap } from "../visualization/map.js";

/** The map only changes when `npm run map` runs, so it is read once and kept in memory. */
export function createMapRouter(db: Db): Router {
  const router = Router();
  let cached: EmbeddingMap | null = null;

  router.get("/embedding-map", async (_req, res) => {
    cached ??= await readEmbeddingMap(db);
    res.set("Cache-Control", "public, max-age=300");
    res.json(cached);
  });

  return router;
}
