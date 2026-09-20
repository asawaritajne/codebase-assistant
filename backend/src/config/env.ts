import path from "node:path";
import dotenv from "dotenv";

// The .env file lives at the repo root so every service can share it. A missing
// file is fine: on Render the variables come from the dashboard instead.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

export interface AppConfig {
  githubToken: string;
  geminiApiKey: string;
  mongoUri: string;
  mongoDbName: string;
  port: number;
  /** Browser origins allowed to call the API, i.e. where the frontend is served from. */
  corsOrigins: string[];
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    githubToken: required("GITHUB_TOKEN"),
    geminiApiKey: required("GEMINI_API_KEY"),
    mongoUri: required("MONGODB_URI"),
    mongoDbName: "codebase_assistant",
    port: Number(process.env.PORT) || 3001,
    // Defaults to the local Vite dev server; set CORS_ORIGINS to the deployed frontend's URL.
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
