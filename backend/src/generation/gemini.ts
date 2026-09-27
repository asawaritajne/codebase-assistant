import type { GoogleGenAI } from "@google/genai";
import { GeminiUnavailableError, createGeminiClient, dailyQuotaError, sleep, withDeadline } from "../gemini/client.js";

/**
 * Tried in order. The free tier's main Flash model is regularly overloaded ("high demand"), and a
 * single-model setup makes the whole site look broken whenever that happens, so slower but calmer
 * models back it up.
 */
export const GENERATION_MODELS = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest"];
/** Roomy enough that the model's internal reasoning can't crowd out the answer itself. */
const MAX_OUTPUT_TOKENS = 4096;
/**
 * A model that answers "high demand" does so within a second or two, so trying it again straight
 * away is wasted time: move to the next model and come back on a second pass.
 */
const PASSES = 2;
const PAUSE_BETWEEN_PASSES_MS = 2_000;
/** Total time to spend across all models; the browser gives up at 120s. */
const TOTAL_BUDGET_MS = 100_000;

export interface GeneratedAnswer {
  text: string;
  /** The model that actually answered, which may not be the first choice. */
  model: string;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);

export class GeminiGenerator {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = createGeminiClient(apiKey);
  }

  /**
   * Generates one answer, retrying transient failures and falling back to the next model when one
   * stays unavailable. Throws GeminiUnavailableError if they all fail within the time budget.
   */
  async generate(systemInstruction: string, prompt: string): Promise<GeneratedAnswer> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const failures: string[] = [];

    for (let pass = 0; pass < PASSES; pass++) {
      for (const model of GENERATION_MODELS) {
        if (Date.now() > deadline) return this.giveUp([...failures, "ran out of time"]);
        try {
          return { text: await this.request(model, systemInstruction, prompt), model };
        } catch (error) {
          // A spent daily quota is the one failure another model can't solve.
          const quota = dailyQuotaError(error, "generation");
          if (quota) throw quota;
          console.warn(`[gemini] generation: ${model} unavailable (${describe(error)})`);
          failures.push(`${model}: ${describe(error)}`);
        }
      }
      if (Date.now() < deadline) await sleep(PAUSE_BETWEEN_PASSES_MS);
    }

    return this.giveUp(failures);
  }

  private giveUp(failures: string[]): never {
    console.error(`[gemini] generation: every model failed — ${failures.join(" | ")}`);
    throw new GeminiUnavailableError("Gemini is too busy to answer right now. Please try again in a moment.");
  }

  private async request(model: string, systemInstruction: string, prompt: string): Promise<string> {
    const response = await withDeadline("generation", (abortSignal) =>
      this.ai.models.generateContent({
        model,
        contents: prompt,
        // Low temperature: answers should stick to the sources rather than paraphrase freely.
        config: { systemInstruction, temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS, abortSignal },
      }),
    );
    const text = response.text?.trim();
    if (!text) {
      throw new Error(`no answer text (finish reason: ${response.candidates?.[0]?.finishReason ?? "unknown"})`);
    }
    return text;
  }
}
