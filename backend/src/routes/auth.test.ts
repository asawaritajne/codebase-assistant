import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { requireAdmin } from "./auth.js";

/** The parts of req/res this middleware touches, and a record of what it did. */
function exchange(authorization?: string) {
  const sent: { status?: number; body?: { error?: string } } = {};
  let passed = false;

  const req = { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : undefined) } as Request;
  const res = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: { error?: string }) {
      sent.body = body;
      return this;
    },
  } as unknown as Response;

  return { req, res, sent, next: () => void (passed = true), get passed() { return passed; } };
}

describe("requireAdmin", () => {
  it("lets a correct token through", () => {
    const call = exchange("Bearer s3cret");
    requireAdmin("s3cret")(call.req, call.res, call.next);
    assert.equal(call.passed, true);
    assert.equal(call.sent.status, undefined);
  });

  it("refuses a wrong token", () => {
    const call = exchange("Bearer wrong!");
    requireAdmin("s3cret")(call.req, call.res, call.next);
    assert.equal(call.passed, false);
    assert.equal(call.sent.status, 401);
  });

  it("refuses a missing header", () => {
    const call = exchange();
    requireAdmin("s3cret")(call.req, call.res, call.next);
    assert.equal(call.passed, false);
    assert.equal(call.sent.status, 401);
  });

  it("refuses a token sent without the Bearer scheme", () => {
    const call = exchange("s3cret");
    requireAdmin("s3cret")(call.req, call.res, call.next);
    assert.equal(call.passed, false);
    assert.equal(call.sent.status, 401);
  });

  it("refuses a token that merely starts with the right characters", () => {
    const call = exchange("Bearer s3c");
    requireAdmin("s3cret")(call.req, call.res, call.next);
    assert.equal(call.passed, false);
    assert.equal(call.sent.status, 401);
  });

  it("fails closed when no token is configured, rather than letting everyone in", () => {
    // Forgetting the variable in production must not leave ingestion open.
    const call = exchange("Bearer anything");
    requireAdmin(null)(call.req, call.res, call.next);
    assert.equal(call.passed, false);
    assert.equal(call.sent.status, 503);
    assert.match(call.sent.body?.error ?? "", /ADMIN_TOKEN/);
  });
});
