import { Router } from "express";
import type { Db } from "mongodb";
import { isRating, readQualityMetrics, recordFeedback } from "../qa/quality.js";

export function createQualityRouter(db: Db): Router {
  const router = Router();

  /** Aggregate answer quality: citation pass rate, regenerations, latency, and reader ratings. */
  router.get("/quality", async (_req, res) => {
    // Short cache: the dashboard is read far more often than answers are recorded.
    res.set("Cache-Control", "public, max-age=30");
    res.json(await readQualityMetrics(db));
  });

  /** A reader's verdict on one answer, keyed by the id behind its permanent link. */
  router.post("/answers/:id/feedback", async (req, res) => {
    const rating = (req.body as { rating?: unknown } | undefined)?.rating;
    if (!isRating(rating)) {
      res.status(400).json({ error: 'Body must include "rating", either "up" or "down"' });
      return;
    }

    if (!(await recordFeedback(db, req.params.id, rating))) {
      res.status(404).json({ error: "No answer with that id" });
      return;
    }
    res.json({ ok: true, rating });
  });

  return router;
}
