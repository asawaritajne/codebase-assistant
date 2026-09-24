import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { percentile, summarizeQuality, type QualityRecord } from "./quality.js";

const record = (overrides: Partial<QualityRecord> = {}): QualityRecord => ({
  id: "a1",
  repo: "react-hook-form/react-hook-form",
  repoId: "react-hook-form",
  question: "How does validation work?",
  createdAt: new Date("2026-09-20T10:00:00Z"),
  valid: true,
  regenerated: false,
  model: "gemini-flash-latest",
  latencyMs: 4000,
  retrievalMs: 200,
  sources: 5,
  citedSources: 4,
  uncitedParagraphs: 0,
  rating: null,
  ...overrides,
});

describe("percentile", () => {
  it("returns 0 for no values", () => {
    assert.equal(percentile([], 0.5), 0);
  });

  it("takes the nearest rank rather than interpolating", () => {
    assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
    assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  });

  it("ignores the order it is given", () => {
    assert.equal(percentile([40, 10, 30, 20], 0.5), 20);
  });
});

describe("summarizeQuality", () => {
  it("reports zeroes rather than NaN when nothing has been asked", () => {
    const metrics = summarizeQuality([]);
    assert.equal(metrics.answers, 0);
    assert.equal(metrics.citations.passRate, 0);
    assert.equal(metrics.feedback.helpfulRate, 0);
    assert.equal(metrics.since, null);
    assert.deepEqual(metrics.repos, []);
  });

  it("measures citation pass rate, regenerations, and source use", () => {
    const metrics = summarizeQuality([
      record(),
      record({ id: "a2", valid: false, regenerated: true, citedSources: 0 }),
      record({ id: "a3", citedSources: 5 }),
      record({ id: "a4", citedSources: 1 }),
    ]);

    assert.equal(metrics.answers, 4);
    assert.equal(metrics.citations.passed, 3);
    assert.equal(metrics.citations.flagged, 1);
    assert.equal(metrics.citations.passRate, 75);
    assert.equal(metrics.regeneration.count, 1);
    assert.equal(metrics.regeneration.rate, 25);
    assert.equal(metrics.sources.retrieved, 20);
    assert.equal(metrics.sources.cited, 10);
    assert.equal(metrics.sources.citedRate, 50);
  });

  it("counts only rated answers in the helpful rate", () => {
    const metrics = summarizeQuality([
      record({ id: "a1", rating: "up" }),
      record({ id: "a2", rating: "up" }),
      record({ id: "a3", rating: "down" }),
      record({ id: "a4", rating: null }),
    ]);

    assert.deepEqual(metrics.feedback, { up: 2, down: 1, rated: 3, helpfulRate: 66.7 });
  });

  it("breaks the numbers down per repository, busiest first", () => {
    const metrics = summarizeQuality([
      record({ id: "a1", latencyMs: 1000 }),
      record({ id: "a2", latencyMs: 3000, valid: false }),
      record({ id: "a3", repoId: "zustand", repo: "pmndrs/zustand", latencyMs: 9000, rating: "down" }),
    ]);

    assert.equal(metrics.repos.length, 2);
    assert.deepEqual(metrics.repos[0], {
      repoId: "react-hook-form",
      repo: "react-hook-form/react-hook-form",
      answers: 2,
      passRate: 50,
      medianMs: 1000,
      up: 0,
      down: 0,
    });
    assert.equal(metrics.repos[1]?.repoId, "zustand");
    assert.equal(metrics.repos[1]?.down, 1);
  });

  it("leaves out answers recorded before repositories were stored with them", () => {
    const metrics = summarizeQuality([
      record({ id: "a1" }),
      record({ id: "a2", repoId: "", repo: "" }),
    ]);

    assert.equal(metrics.answers, 2);
    assert.deepEqual(
      metrics.repos.map((repo) => repo.repoId),
      ["react-hook-form"],
    );
  });

  it("groups answers by day in chronological order", () => {
    const metrics = summarizeQuality([
      record({ id: "a1", createdAt: new Date("2026-09-22T08:00:00Z") }),
      record({ id: "a2", createdAt: new Date("2026-09-20T23:00:00Z"), valid: false }),
      record({ id: "a3", createdAt: new Date("2026-09-20T01:00:00Z") }),
    ]);

    assert.deepEqual(metrics.daily, [
      { date: "2026-09-20", answers: 2, flagged: 1 },
      { date: "2026-09-22", answers: 1, flagged: 0 },
    ]);
    assert.equal(metrics.since, "2026-09-20T01:00:00.000Z");
    assert.equal(metrics.until, "2026-09-22T08:00:00.000Z");
  });

  it("lists the most recent answers first", () => {
    const metrics = summarizeQuality([
      record({ id: "old", createdAt: new Date("2026-09-01T00:00:00Z") }),
      record({ id: "new", createdAt: new Date("2026-09-23T00:00:00Z") }),
    ]);

    assert.deepEqual(
      metrics.recent.map((answer) => answer.id),
      ["new", "old"],
    );
  });

  it("ranks the models that produced the answers", () => {
    const metrics = summarizeQuality([
      record({ id: "a1", model: "gemini-flash-lite-latest" }),
      record({ id: "a2", model: "gemini-flash-latest" }),
      record({ id: "a3", model: "gemini-flash-latest" }),
    ]);

    assert.deepEqual(metrics.models, [
      { model: "gemini-flash-latest", answers: 2 },
      { model: "gemini-flash-lite-latest", answers: 1 },
    ]);
  });
});
