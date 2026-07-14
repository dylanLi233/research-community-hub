import { describe, expect, it } from "vitest";

import {
  createApiClientSchema,
  createApiTokenSchema,
  reviewModeSchema,
  updateApiClientSchema,
} from "./validation";

describe("integration management validation", () => {
  it("accepts known scopes and removes duplicates", () => {
    const result = createApiClientSchema.parse({
      name: "Hermes Production",
      scopes: ["reports:write", "reports:write", "assets:write"],
    });

    expect(result.scopes).toEqual(["reports:write", "assets:write"]);
  });

  it("rejects unknown or empty scope lists", () => {
    expect(
      createApiClientSchema.safeParse({ name: "Hermes", scopes: [] }).success,
    ).toBe(false);
    expect(
      createApiClientSchema.safeParse({
        name: "Hermes",
        scopes: ["unknown"],
      }).success,
    ).toBe(false);
  });

  it("rejects empty client updates", () => {
    expect(updateApiClientSchema.safeParse({}).success).toBe(false);
  });

  it("parses an optional token expiry", () => {
    expect(createApiTokenSchema.parse({})).toEqual({});
    expect(
      createApiTokenSchema.parse({ expiresAt: "2027-01-01T00:00:00Z" })
        .expiresAt,
    ).toBeInstanceOf(Date);
  });

  it("allows only on and off review modes", () => {
    expect(reviewModeSchema.safeParse({ mode: "on" }).success).toBe(true);
    expect(reviewModeSchema.safeParse({ mode: "off" }).success).toBe(true);
    expect(reviewModeSchema.safeParse({ mode: "auto" }).success).toBe(false);
  });
});
