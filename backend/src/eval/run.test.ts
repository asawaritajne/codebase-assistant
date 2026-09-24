import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EVAL_CASES } from "./dataset.js";
import { rankOfExpected, scoreByRepo, scoreResults, type CaseResult, type RetrievedFile } from "./run.js";

const file = (title: string): RetrievedFile => ({
  title,
  type: "code",
  score: 0.8,
  sourceUrl: `https://github.com/x/y/blob/main/${title}`,
});

const result = (overrides: Partial<CaseResult> = {}): CaseResult => ({
  id: "case",
  repoId: "zustand",
  question: "How does setState notify subscribers?",
  expect: ["src/vanilla.ts"],
  because: "createStore holds the listeners.",
  retrieved: [file("src/vanilla.ts")],
  rank: 1,
  ...overrides,
});

describe("the benchmark dataset", () => {
  it("has unique case ids", () => {
    const ids = EVAL_CASES.map((testCase) => testCase.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("names at least one expected file for every case", () => {
    for (const testCase of EVAL_CASES) {
      assert.ok(testCase.expect.length > 0, `${testCase.id} expects nothing`);
      assert.ok(testCase.question.endsWith("?"), `${testCase.id} is not a question`);
      assert.ok(testCase.because.length > 0, `${testCase.id} has no justification`);
    }
  });
});

describe("rankOfExpected", () => {
  it("returns the 1-based position of the first expected file", () => {
    const retrieved = [file("tests/basic.test.tsx"), file("src/vanilla.ts")];
    assert.equal(rankOfExpected(retrieved, ["src/vanilla.ts"]), 2);
  });

  it("accepts any of the expected files", () => {
    const retrieved = [file("src/shallow.ts")];
    assert.equal(rankOfExpected(retrieved, ["src/vanilla/shallow.ts", "src/shallow.ts"]), 1);
  });

  it("returns null when none of them were retrieved", () => {
    assert.equal(rankOfExpected([file("tests/basic.test.tsx")], ["src/vanilla.ts"]), null);
  });
});

describe("scoreResults", () => {
  it("counts a hit at every depth it reaches", () => {
    const score = scoreResults([
      result({ id: "a", rank: 1 }),
      result({ id: "b", rank: 3 }),
      result({ id: "c", rank: 5 }),
      result({ id: "d", rank: null }),
    ]);

    assert.equal(score.cases, 4);
    assert.equal(score.hitAt1, 25);
    assert.equal(score.hitAt3, 50);
    assert.equal(score.hitAt5, 75);
    assert.equal(score.misses, 1);
  });

  it("computes mean reciprocal rank, counting a miss as zero", () => {
    // 1/1 + 1/2 + 0 = 1.5, over three cases.
    const score = scoreResults([
      result({ id: "a", rank: 1 }),
      result({ id: "b", rank: 2 }),
      result({ id: "c", rank: null }),
    ]);
    assert.equal(score.mrr, 0.5);
  });

  it("leaves skipped cases out of the score entirely", () => {
    const score = scoreResults([
      result({ id: "a", rank: 1 }),
      result({ id: "b", rank: null, skipped: "not indexed yet" }),
    ]);

    assert.equal(score.cases, 1);
    assert.equal(score.hitAt1, 100);
    assert.equal(score.misses, 0);
  });

  it("returns zeroes when every case was skipped", () => {
    const score = scoreResults([result({ rank: null, skipped: "not indexed yet" })]);
    assert.deepEqual(score, { cases: 0, hitAt1: 0, hitAt3: 0, hitAt5: 0, mrr: 0, misses: 0 });
  });

  it("scores the baseline separately from the live policy", () => {
    const results = [
      result({ id: "a", rank: 1, rankBaseline: null }),
      result({ id: "b", rank: 2, rankBaseline: 4 }),
    ];

    assert.equal(scoreResults(results).hitAt3, 100);
    assert.equal(scoreResults(results, "baseline").hitAt3, 0);
    assert.equal(scoreResults(results, "baseline").misses, 1);
  });
});

describe("scoreByRepo", () => {
  it("scores each repository on its own cases, best first", () => {
    const repos = scoreByRepo([
      result({ id: "a", repoId: "zustand", rank: null }),
      result({ id: "b", repoId: "express", rank: 1 }),
      result({ id: "c", repoId: "express", rank: 2 }),
    ]);

    assert.deepEqual(
      repos.map((repo) => repo.repoId),
      ["express", "zustand"],
    );
    assert.equal(repos[0]?.hitAt5, 100);
    assert.equal(repos[0]?.cases, 2);
    assert.equal(repos[1]?.hitAt5, 0);
  });

  it("drops a repository whose cases were all skipped", () => {
    const repos = scoreByRepo([
      result({ id: "a", repoId: "vite", rank: null, skipped: "not indexed yet" }),
      result({ id: "b", repoId: "express", rank: 1 }),
    ]);

    assert.deepEqual(
      repos.map((repo) => repo.repoId),
      ["express"],
    );
  });
});
