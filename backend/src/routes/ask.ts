import { Router } from "express";
import type { Db } from "mongodb";
import { REPOS, findRepo } from "../config/repos.js";
import type { GeminiEmbedder } from "../embedding/gemini.js";
import type { GeminiGenerator } from "../generation/gemini.js";
import { GeminiQuotaExhaustedError } from "../gemini/client.js";
import { answerQuestion } from "../qa/ask.js";

const MAX_QUESTION_LENGTH = 1000;

export function createAskRouter(db: Db, embedder: GeminiEmbedder, generator: GeminiGenerator): Router {
  const router = Router();

  router.post("/ask", async (req, res) => {
    const body = req.body as { question?: unknown; repo?: unknown } | undefined;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const repo = typeof body?.repo === "string" ? findRepo(body.repo) : undefined;

    if (!repo) {
      res.status(400).json({ error: `Body must include "repo", one of: ${REPOS.map((r) => r.id).join(", ")}` });
      return;
    }
    if (!question) {
      res.status(400).json({ error: 'Body must include a non-empty "question" string' });
      return;
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({ error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` });
      return;
    }

    try {
      res.json(await answerQuestion(db, embedder, generator, { question, repo: repo.fullName }));
    } catch (error) {
      if (error instanceof GeminiQuotaExhaustedError) {
        res.status(429).json({ error: "Gemini's free-tier quota is used up; try again later.", detail: error.message });
        return;
      }
      throw error;
    }
  });

  return router;
}
