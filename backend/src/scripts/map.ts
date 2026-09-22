// Usage: npm run map — recomputes the 3D projection of every embedded chunk.
// Run it after an embedding run so the website's galaxy includes the new chunks.
import { loadConfig } from "../config/env.js";
import { connectToDatabase } from "../db/mongo.js";
import { buildEmbeddingMap } from "../visualization/map.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { client, db } = await connectToDatabase(config.mongoUri, config.mongoDbName);
  try {
    const startedAt = Date.now();
    console.log("[map] Projecting embeddings to 3D…");
    const points = await buildEmbeddingMap(db);
    console.log(`[map] Stored ${points} points in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(`[map] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
