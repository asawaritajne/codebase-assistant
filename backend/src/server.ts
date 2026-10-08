import compression from "compression";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { loadConfig } from "./config/env.js";
import { connectToDatabase } from "./db/mongo.js";
import { GeminiEmbedder } from "./embedding/gemini.js";
import { GeminiGenerator } from "./generation/gemini.js";
import { GitHubClient } from "./ingestion/github.js";
import { RepoCatalog } from "./repos/catalog.js";
import { createAskRouter } from "./routes/ask.js";
import { createEvaluationRouter } from "./routes/evaluation.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createMapRouter } from "./routes/map.js";
import { createQualityRouter } from "./routes/quality.js";
import { createReposRouter } from "./routes/repos.js";

const config = loadConfig();
const { client, db } = await connectToDatabase(config.mongoUri, config.mongoDbName);

const github = new GitHubClient(config.githubToken);
const catalog = new RepoCatalog(db, github);
const embedder = new GeminiEmbedder(config.geminiApiKey);
const generator = new GeminiGenerator(config.geminiApiKey);

const app = express();
// Render terminates TLS in front of the app; without this req.ip is the proxy's address.
app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigins }));
// The embedding map is a big JSON payload; gzip takes it from megabytes to a few hundred KB.
app.use(compression());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use(createReposRouter(catalog));
app.use(createMapRouter(db, embedder));
app.use(createAskRouter(db, embedder, generator));
app.use(createQualityRouter(db));
app.use(createEvaluationRouter(db));
app.use(createIngestRouter(db, github, catalog, config.adminToken));

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("[server]", error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
};
app.use(handleError);

const server = app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
});

function shutdown(): void {
  server.close(() => void client.close());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
