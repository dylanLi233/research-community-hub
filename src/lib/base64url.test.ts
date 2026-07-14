import { describe, expect, it } from "vitest";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual,
} from "./base64url";

describe("base64url helpers", () => {
  it("round-trips bytes without padding", () => {
    const input = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = bytesToBase64Url(input);

    expect(encoded).not.toContain("=");
    expect(base64UrlToBytes(encoded)).toEqual(input);
  });

  it("rejects invalid alphabet characters", () => {
    expect(() => base64UrlToBytes("not+base64")).toThrow(
      "Invalid base64url value",
    );
  });

  it("compares equal and unequal byte arrays", () => {
    expect(
      constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])),
    ).toBe(true);
    expect(
      constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])),
    ).toBe(false);
    expect(
      constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0])),
    ).toBe(false);
  });
});
