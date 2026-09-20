import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RetrievedChunk } from "../retrieval/search.js";
import { generateGroundedAnswer } from "./ask.js";

const chunk = (path: string): RetrievedChunk => ({
  repo: "owner/repo",
  type: "code",
  sourceId: path,
  sourceUrl: `https://github.com/owner/repo/blob/abc123/${path}`,
  title: path,
  chunkIndex: 0,
  text: "export const retries = 3;",
  isTest: false,
  embeddingModel: "test-model",
  createdAt: new Date(),
  score: 0.9,
});

/** Stands in for Gemini: returns the given answers in order and records each prompt. */
function fakeGenerator(...answers: string[]) {
  const prompts: string[] = [];
  return {
    prompts,
    async generate(_systemInstruction: string, prompt: string): Promise<string> {
      prompts.push(prompt);
      const answer = answers.shift();
      if (answer === undefined) throw new Error("Generator called more times than expected");
      return answer;
    },
  };
}

describe("generateGroundedAnswer", () => {
  it("keeps a well-cited answer without asking again", async () => {
    const generator = fakeGenerator("It retries three times [S1].");
    const result = await generateGroundedAnswer(generator, "owner/repo", "How many retries?", [chunk("a.ts")]);

    assert.equal(result.answer, "It retries three times [S1].");
    assert.equal(result.regenerated, false);
    assert.equal(result.citations.valid, true);
    assert.equal(generator.prompts.length, 1);
  });

  it("asks once more when the answer cites a source that doesn't exist", async () => {
    const generator = fakeGenerator("It retries three times [S4].", "It retries three times [S1].");
    const result = await generateGroundedAnswer(generator, "owner/repo", "How many retries?", [chunk("a.ts")]);

    assert.equal(result.answer, "It retries three times [S1].");
    assert.equal(result.regenerated, true);
    assert.equal(result.citations.valid, true);
    assert.match(generator.prompts[1]!, /cited sources that don't exist \(S4\); only S1 to S1 exist/);
  });

  it("returns the second attempt with a failing report if it is still uncited", async () => {
    const generator = fakeGenerator("It retries three times.", "It really does retry three times.");
    const result = await generateGroundedAnswer(generator, "owner/repo", "How many retries?", [chunk("a.ts")]);

    assert.equal(result.answer, "It really does retry three times.");
    assert.equal(result.regenerated, true);
    assert.equal(result.citations.valid, false);
    assert.deepEqual(result.citations.citedMarkers, []);
    assert.match(generator.prompts[1]!, /didn't cite any sources/);
  });
});
