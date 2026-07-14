import { describe, expect, it } from "vitest";

import {
  byteLength,
  hashImportRequest,
  ImportRequestError,
  stableStringify,
  validateClientRequestId,
  validateIdempotencyKey,
} from "./idempotency";

function expectImportError(callback: () => unknown, code: string): void {
  try {
    callback();
    throw new Error("Expected import request validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ImportRequestError);
    expect(error).toMatchObject({ code });
  }
}

describe("import idempotency headers", () => {
  it("accepts printable non-whitespace ASCII keys", () => {
    expect(validateIdempotencyKey("report-2026-07-14-v1")).toBe(
      "report-2026-07-14-v1",
    );
  });

  it("rejects missing, whitespace, control and oversized keys", () => {
    expectImportError(() => validateIdempotencyKey(null), "IDEMPOTENCY_KEY_REQUIRED");
    expectImportError(
      () => validateIdempotencyKey("contains space"),
      "INVALID_IDEMPOTENCY_KEY",
    );
    expectImportError(
      () => validateIdempotencyKey("line\nbreak"),
      "INVALID_IDEMPOTENCY_KEY",
    );
    expectImportError(
      () => validateIdempotencyKey("x".repeat(201)),
      "INVALID_IDEMPOTENCY_KEY",
    );
  });

  it("accepts an optional UUID request id", () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000";

    expect(validateClientRequestId(null)).toBeNull();
    expect(validateClientRequestId(requestId)).toBe(requestId);
    expectImportError(
      () => validateClientRequestId("not-a-uuid"),
      "INVALID_REQUEST_ID",
    );
  });
});

describe("stable import hashing", () => {
  it("canonicalizes object key order recursively", () => {
    expect(
      stableStringify({ b: 2, a: { d: 4, c: 3 }, list: [{ z: 1, y: 2 }] }),
    ).toBe(
      stableStringify({ list: [{ y: 2, z: 1 }], a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("produces equal hashes for semantically identical JSON", async () => {
    const first = await hashImportRequest({ title: "A", source: { b: 2, a: 1 } });
    const second = await hashImportRequest({ source: { a: 1, b: 2 }, title: "A" });
    const changed = await hashImportRequest({ source: { a: 1, b: 3 }, title: "A" });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("measures UTF-8 request bytes rather than JavaScript characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("研报")).toBe(6);
  });
});
