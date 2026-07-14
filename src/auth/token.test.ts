import { describe, expect, it } from "vitest";

import {
  constantTimeEqualText,
  generateOpaqueToken,
  hashOpaqueToken,
} from "./token";

describe("opaque authentication tokens", () => {
  it("generates unique high-entropy URL-safe values", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically without returning the raw token", async () => {
    const token = "example-session-token";
    const first = await hashOpaqueToken(token);
    const second = await hashOpaqueToken(token);

    expect(first).toBe(second);
    expect(first).not.toContain(token);
  });

  it("compares secrets without direct string equality", async () => {
    await expect(constantTimeEqualText("secret", "secret")).resolves.toBe(true);
    await expect(constantTimeEqualText("secret", "other")).resolves.toBe(false);
  });
});
