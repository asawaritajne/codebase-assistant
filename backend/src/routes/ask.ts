import { Router } from "express";
import type { Db } from "mongodb";
import { REPOS, findRepo } from "../config/repos.js";
import type { GeminiEmbedder } from "../embedding/gemini.js";
import type { GeminiGenerator } from "../generation/gemini.js";
import { GeminiQuotaExhaustedError, GeminiUnavailableError } from "../gemini/client.js";
import type { ConversationTurn } from "../generation/prompt.js";
import { MAX_HISTORY_TURNS, answerQuestion } from "../qa/ask.js";
import { readSharedAnswer } from "../qa/history.js";

const MAX_QUESTION_LENGTH = 1000;

/** Accepts only well-formed prior turns, and never more than the pipeline will use. */
function parseHistory(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is ConversationTurn =>
        typeof turn === "object" &&
        turn !== null &&
        typeof (turn as ConversationTurn).question === "string" &&
        typeof (turn as ConversationTurn).answer === "string",
    )
    .slice(-MAX_HISTORY_TURNS);
}

export function createAskRouter(db: Db, embedder: GeminiEmbedder, generator: GeminiGenerator): Router {
  const router = Router();

  router.post("/ask", async (req, res) => {
    const body = req.body as { question?: unknown; repo?: unknown; history?: unknown } | undefined;
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
      res.json(
        await answerQuestion(db, embedder, generator, {
          question,
          repo: repo.fullName,
          repoId: repo.id,
          history: parseHistory(body?.history),
        }),
      );
    } catch (error) {
      if (error instanceof GeminiUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      if (error instanceof GeminiQuotaExhaustedError) {
        res.status(429).json({ error: "Gemini's free-tier quota is used up; try again later.", detail: error.message });
        return;
      }
      throw error;
    }
  });

  /** The permanent link behind every answer. */
  router.get("/answers/:id", async (req, res) => {
    const answer = await readSharedAnswer(db, req.params.id);
    if (!answer) {
      res.status(404).json({ error: "No answer with that id" });
      return;
    }
    res.set("Cache-Control", "public, max-age=600");
    res.json(answer);
  });

  return router;
}
