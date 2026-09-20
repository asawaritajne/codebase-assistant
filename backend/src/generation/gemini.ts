import type { GoogleGenAI } from "@google/genai";
import { createGeminiClient, planRetry, sleep } from "../gemini/client.js";

/**
 * Alias Google points at the current stable Flash model. The pinned newest model
 * (gemini-3.8-flash) answered 503 "high demand" on the free tier, so the alias is steadier here.
 */
export const GENERATION_MODEL = "gemini-flash-latest";
/** Roomy enough that the model's internal reasoning can't crowd out the answer itself. */
const MAX_OUTPUT_TOKENS = 4096;

export class GeminiGenerator {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = createGeminiClient(apiKey);
  }

  /** Generates one answer, backing off on rate limits and transient errors. */
  async generate(systemInstruction: string, prompt: string): Promise<string> {
    for (let retries = 0; ; retries++) {
      try {
        const response = await this.ai.models.generateContent({
          model: GENERATION_MODEL,
          contents: prompt,
          // Low temperature: answers should stick to the sources rather than paraphrase freely.
          config: { systemInstruction, temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS },
        });
        const text = response.text?.trim();
        if (!text) {
          throw new Error(
            `Gemini returned no answer text (finish reason: ${response.candidates?.[0]?.finishReason ?? "unknown"})`,
          );
        }
        return text;
      } catch (error) {
        const plan = planRetry(error, retries, "generation");
        await sleep(plan.waitSeconds * 1000);
      }
    }
  }
}
