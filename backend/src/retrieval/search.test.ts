import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeWithNonTestFloor, type RetrievedChunk } from "./search.js";

const chunk = (sourceId: string, score: number, isTest: boolean, chunkIndex = 0): RetrievedChunk =>
  ({
    sourceId,
    chunkIndex,
    score,
    isTest,
    repo: "pmndrs/zustand",
    type: "code",
    sourceUrl: `https://github.com/pmndrs/zustand/blob/main/${sourceId}`,
    title: sourceId,
    text: "",
    embeddingModel: "gemini-embedding-2",
    createdAt: new Date(),
  }) as RetrievedChunk;

describe("mergeWithNonTestFloor", () => {
  it("makes room for implementation when tests take every slot", () => {
    const ranked = [
      chunk("tests/persistAsync.test.tsx", 0.86, true),
      chunk("tests/persistSync.test.tsx", 0.85, true),
      chunk("tests/basic.test.tsx", 0.84, true),
      chunk("tests/devtools.test.tsx", 0.83, true),
      chunk("tests/ssr.test.tsx", 0.82, true),
    ];
    const nonTest = [chunk("src/middleware/persist.ts", 0.81, false), chunk("src/vanilla.ts", 0.8, false)];

    const merged = mergeWithNonTestFloor(ranked, nonTest, 5, 2);

    assert.equal(merged.length, 5);
    assert.deepEqual(
      merged.filter((result) => !result.isTest).map((result) => result.title),
      ["src/middleware/persist.ts", "src/vanilla.ts"],
    );
    // The highest-scoring test is still there; only the weakest ones were displaced.
    assert.equal(merged[0]!.title, "tests/persistAsync.test.tsx");
  });

  it("counts implementation the unrestricted search already found", () => {
    const ranked = [
      chunk("src/vanilla.ts", 0.9, false),
      chunk("tests/basic.test.tsx", 0.88, true),
      chunk("src/react.ts", 0.87, false),
      chunk("tests/ssr.test.tsx", 0.86, true),
      chunk("tests/devtools.test.tsx", 0.85, true),
    ];
    const nonTest = [chunk("src/vanilla.ts", 0.9, false), chunk("src/shallow.ts", 0.7, false)];

    const merged = mergeWithNonTestFloor(ranked, nonTest, 5, 2);

    // Two non-test chunks were already ranked, so nothing needed promoting.
    assert.deepEqual(
      merged.map((result) => result.title),
      ranked.map((result) => result.title),
    );
  });

  it("never returns the same chunk twice", () => {
    const shared = chunk("src/vanilla.ts", 0.9, false);
    const merged = mergeWithNonTestFloor([shared, chunk("tests/a.test.ts", 0.8, true)], [shared], 5, 2);

    assert.equal(merged.length, 2);
    assert.equal(new Set(merged.map((result) => result.title)).size, 2);
  });

  it("keeps chunks of the same file apart by their index", () => {
    const merged = mergeWithNonTestFloor(
      [chunk("src/vanilla.ts", 0.9, false, 0), chunk("src/vanilla.ts", 0.88, false, 1)],
      [],
      5,
      1,
    );

    assert.equal(merged.length, 2);
  });

  it("returns results in score order", () => {
    const merged = mergeWithNonTestFloor(
      [chunk("tests/a.test.ts", 0.9, true), chunk("tests/b.test.ts", 0.89, true)],
      [chunk("src/vanilla.ts", 0.95, false)],
      3,
      1,
    );

    assert.deepEqual(
      merged.map((result) => result.score),
      [0.95, 0.9, 0.89],
    );
  });

  it("returns fewer than the limit when that is all there is", () => {
    const merged = mergeWithNonTestFloor([chunk("src/vanilla.ts", 0.9, false)], [], 5, 3);
    assert.equal(merged.length, 1);
  });
});
