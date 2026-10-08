import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCitations, extractMarkers, needsRegeneration } from "./citations.js";

describe("extractMarkers", () => {
  it("reads single, adjacent, and grouped markers", () => {
    assert.deepEqual(extractMarkers("A [S1]. B [S2][S3]. C [S4, S5] and [S1; S2]."), [
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S1",
      "S2",
    ]);
  });

  it("ignores bracketed text that isn't a citation", () => {
    assert.deepEqual(extractMarkers("Use `errors[name]`, [see the docs], or [S1a]."), []);
  });
});

describe("checkCitations", () => {
  it("accepts an answer whose every statement cites a real source", () => {
    const answer = [
      "Validation works in two steps:",
      "",
      "### 1. Checking for rules",
      "- `hasValidation` looks for configured rules [S1].",
      "- `validateField` then runs them [S2][S3].",
      "",
      "```ts",
      "validateField(field); // code needs no citation",
      "```",
      "",
      "**Unmounted fields**",
      "",
      "They are skipped entirely [S2].",
    ].join("\n");

    const report = checkCitations(answer, 5);
    assert.deepEqual(report, { valid: true, citedMarkers: ["S1", "S2", "S3"], invalidMarkers: [], uncitedParagraphs: [] });
    assert.equal(needsRegeneration(report), false);
  });

  it("treats bold list-item labels as lead-ins, not uncited statements", () => {
    // Shape of a real answer that was wrongly flagged: numbered bold labels over cited sub-bullets.
    const answer = [
      "It determines dirty fields via `getDirtyFields` [S1][S2]:",
      "",
      "1. **Comparing Form Values with Defaults:**",
      "   * It compares default values against current values [S1][S5].",
      "2. **Traversable vs. Leaf Fields**",
      "   * Nested objects are walked recursively [S2].",
      "- **Cleaning Empty Containers**:",
      "   * Empty containers are removed [S2].",
    ].join("\n");

    assert.deepEqual(checkCitations(answer, 5).uncitedParagraphs, []);
    // A bold sentence that ends in a full stop still states something, so it still needs a citation.
    assert.deepEqual(checkCitations("Intro [S1].\n\n1. **Values are compared deeply.**", 5).uncitedParagraphs, [
      "1. **Values are compared deeply.**",
    ]);
  });

  it("flags markers that point past the retrieved sources", () => {
    const report = checkCitations("It retries three times [S2][S7]. Off by one [S0].", 5);
    assert.deepEqual(report.citedMarkers, ["S2"]);
    assert.deepEqual(report.invalidMarkers, ["S0", "S7"]);
    assert.equal(report.valid, false);
    assert.equal(needsRegeneration(report), true);
  });

  it("requires regeneration when nothing is cited", () => {
    const report = checkCitations("The library validates fields on submit.", 5);
    assert.equal(report.valid, false);
    assert.equal(needsRegeneration(report), true);
  });

  it("reports uncited statements without forcing regeneration", () => {
    const report = checkCitations("Fields are validated on submit [S1].\n\nThis keeps forms fast.", 5);
    assert.equal(report.valid, false);
    assert.deepEqual(report.uncitedParagraphs, ["This keeps forms fast."]);
    assert.equal(needsRegeneration(report), false);
  });
});

describe("checkCitations with enumerations", () => {
  it("does not demand a citation on each entry of a cited list", () => {
    // The real answer that exposed this reported seven uncited statements, all of them bullets
    // belonging to a list whose lead-in already cited S3.
    const answer = [
      "A field has validation if it is mounted and has any of these rules defined [S3]:",
      "",
      "* `required` (and not explicitly set to `false`)",
      "* `min`",
      "* `maxLength`",
      "* `pattern`",
    ].join("\n");

    const report = checkCitations(answer, 5);
    assert.deepEqual(report.uncitedParagraphs, []);
    assert.equal(report.valid, true);
  });

  it("still demands citations when the lead-in cites nothing", () => {
    const answer = ["A field has validation if it has any of these rules:", "", "* `required`", "* `min`"].join("\n");

    const report = checkCitations(answer, 5);
    assert.equal(report.uncitedParagraphs.length, 2);
  });

  it("still demands a citation from a bullet that makes a claim of its own", () => {
    const answer = [
      "Validation runs in these places [S1]:",
      "",
      "* `onBlur`",
      "* The resolver is called again whenever any registered field changes, which can be expensive.",
    ].join("\n");

    const report = checkCitations(answer, 5);
    assert.equal(report.uncitedParagraphs.length, 1);
    assert.match(report.uncitedParagraphs[0] ?? "", /resolver is called again/);
  });

  it("stops inheriting once an ordinary paragraph ends the list", () => {
    const answer = [
      "The rules are [S1]:",
      "",
      "* `min`",
      "",
      "Validation is skipped entirely for unmounted fields.",
      "",
      "* `max`",
    ].join("\n");

    const report = checkCitations(answer, 5);
    // Both the paragraph and the bullet after it stand on their own.
    assert.equal(report.uncitedParagraphs.length, 2);
  });

  it("stops inheriting across a heading", () => {
    const answer = ["The rules are [S1]:", "", "* `min`", "", "## Resolvers", "", "* `yup`"].join("\n");

    const report = checkCitations(answer, 5);
    assert.deepEqual(report.uncitedParagraphs, ["* `yup`"]);
  });
});
