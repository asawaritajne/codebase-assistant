import { Router } from "express";
import type { Db } from "mongodb";
import { findRepo } from "../config/repos.js";
import type { GeminiEmbedder } from "../embedding/gemini.js";
import { GeminiQuotaExhaustedError } from "../gemini/client.js";
import { retrieveRelevantChunks } from "../retrieval/search.js";
import { projectWithBasis } from "../visualization/projection.js";
import { chunkKey, readEmbeddingMap, readProjectionBasis, type EmbeddingMap } from "../visualization/map.js";

const NEIGHBOURS = 5;
const MAX_QUESTION_LENGTH = 300;

/** The map only changes when `npm run map` runs, so it is read once and kept in memory. */
export function createMapRouter(db: Db, embedder: GeminiEmbedder): Router {
  const router = Router();
  let cached: EmbeddingMap | null = null;

  router.get("/embedding-map", async (_req, res) => {
    cached ??= await readEmbeddingMap(db);
    res.set("Cache-Control", "public, max-age=300");
    res.json(cached);
  });

  /**
   * Places a live question in the same 3D space and names the chunks it would retrieve — the
   * retrieval step of the pipeline, without generating an answer.
   */
  router.post("/embedding-map/query", async (req, res) => {
    const body = req.body as { question?: unknown; repo?: unknown } | undefined;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({ error: `Provide a "question" of 1 to ${MAX_QUESTION_LENGTH} characters` });
      return;
    }
    const repo = typeof body?.repo === "string" ? findRepo(body.repo) : undefined;

    const basis = await readProjectionBasis(db);
    if (!basis) {
      res.status(503).json({ error: "The embedding map hasn't been built yet (run npm run map)." });
      return;
    }

    try {
      const queryVector = await embedder.embedQuery(question);
      const chunks = await retrieveRelevantChunks(db, queryVector, {
        limit: NEIGHBOURS,
        ...(repo ? { filter: { repo: repo.fullName } } : {}),
      });

      res.json({
        question,
        position: projectWithBasis(queryVector, basis),
        neighbours: chunks.map((chunk) => ({
          key: chunkKey(chunk.repo, chunk.sourceId, chunk.chunkIndex),
          title: chunk.title,
          type: chunk.type,
          repo: chunk.repo,
          sourceUrl: chunk.sourceUrl,
          score: chunk.score,
        })),
      });
    } catch (error) {
      if (error instanceof GeminiQuotaExhaustedError) {
        res.status(429).json({ error: "Gemini's free-tier quota is used up; try again later." });
        return;
      }
      throw error;
    }
  });

  return router;
}
