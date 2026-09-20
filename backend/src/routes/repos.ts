import { Router } from "express";
import type { RepoCatalog } from "../repos/catalog.js";

export function createReposRouter(catalog: RepoCatalog): Router {
  const router = Router();

  router.get("/repos", async (_req, res) => {
    res.json({ repos: await catalog.list() });
  });

  return router;
}
