import { Router } from "express";
import type { Db } from "mongodb";
import { findRepo, ingestionOptionsFor } from "../config/repos.js";
import type { GitHubClient } from "../ingestion/github.js";
import { runIngestion } from "../ingestion/ingest.js";
import type { RepoCatalog } from "../repos/catalog.js";

export function createIngestRouter(db: Db, github: GitHubClient, catalog: RepoCatalog): Router {
  const router = Router();
  let running = false;

  // Runs the full pull-and-save for one repo synchronously and responds with the summary.
  router.post("/ingest/:repoId", async (req, res) => {
    const repo = findRepo(req.params.repoId);
    if (!repo) {
      res.status(404).json({ error: `Unknown repo "${req.params.repoId}"` });
      return;
    }
    if (running) {
      res.status(409).json({ error: "An ingestion run is already in progress" });
      return;
    }
    running = true;
    try {
      const summary = await runIngestion(db, github, ingestionOptionsFor(repo));
      catalog.invalidate();
      res.status(summary.completed ? 200 : 429).json(summary);
    } finally {
      running = false;
    }
  });

  return router;
}
