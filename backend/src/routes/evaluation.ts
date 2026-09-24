import { Router } from "express";
import type { Db } from "mongodb";
import { EVAL_CASES } from "../eval/dataset.js";
import { readLatestEvalRun } from "../eval/run.js";

export function createEvaluationRouter(db: Db): Router {
  const router = Router();

  /** The most recent retrieval benchmark run, with every case's result. */
  router.get("/evaluation", async (_req, res) => {
    const run = await readLatestEvalRun(db);
    // The benchmark only changes when it is re-run, which is a manual step.
    res.set("Cache-Control", "public, max-age=300");
    res.json({ run, totalCases: EVAL_CASES.length });
  });

  return router;
}
