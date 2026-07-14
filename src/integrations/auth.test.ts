import { describe, expect, it } from "vitest";

import { evaluateApiCredential } from "./auth";
import { normalizeReviewMode } from "./review-mode";
import { hasApiClientScope, normalizeApiClientScopes } from "./scopes";
import { generateApiToken, parseBearerToken } from "./token";
import { hashOpaqueToken } from "@/auth/token";

describe("Hermes API token format", () => {
  it("generates a high-entropy prefixed token and matching hash", async () => {
    const generated = await generateApiToken();

    expect(generated.token).toMatch(/^rch_live_[A-Za-z0-9_-]{40,}$/);
    expect(generated.tokenPrefix).toBe(generated.token.slice(0, 16));
    expect(generated.tokenHash).toBe(await hashOpaqueToken(generated.token));
    expect(generated.tokenHash).not.toContain(generated.token);
  });

  it("parses only a strict Bearer token", () => {
    const token = `rch_live_${"a".repeat(43)}`;

    expect(parseBearerToken(`Bearer ${token}`)).toBe(token);
    expect(parseBearerToken(`bearer ${token}`)).toBeNull();
    expect(parseBearerToken(`Bearer  ${token}`)).toBeNull();
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken("Bearer short")).toBeNull();
  });
});

describe("API Client scopes", () => {
  it("normalizes known scopes and removes duplicates", () => {
    expect(
      normalizeApiClientScopes([
        "reports:write",
        "reports:write",
        "unknown",
        "assets:write",
      ]),
    ).toEqual(["reports:write", "assets:write"]);
  });

  it("checks exact scope membership", () => {
    expect(hasApiClientScope(["reports:write"], "reports:write")).toBe(true);
    expect(hasApiClientScope(["reports:write"], "assets:write")).toBe(false);
  });
});

describe("API credential policy", () => {
  const base = {
    clientStatus: "active" as const,
    tokenStatus: "active" as const,
    expiresAt: null,
    scopes: ["reports:write"],
    requiredScope: "reports:write" as const,
    now: new Date("2026-07-14T00:00:00Z"),
  };

  it("accepts active credentials with the required scope", () => {
    expect(evaluateApiCredential(base)).toBe("valid");
  });

  it("rejects disabled, revoked and expired credentials uniformly", () => {
    expect(
      evaluateApiCredential({ ...base, clientStatus: "disabled" }),
    ).toBe("invalid");
    expect(evaluateApiCredential({ ...base, tokenStatus: "revoked" })).toBe(
      "invalid",
    );
    expect(
      evaluateApiCredential({
        ...base,
        expiresAt: new Date("2026-07-13T23:59:59Z"),
      }),
    ).toBe("invalid");
  });

  it("distinguishes missing scope from invalid credentials", () => {
    expect(
      evaluateApiCredential({ ...base, requiredScope: "assets:write" }),
    ).toBe("scope_denied");
  });
});

describe("review mode defaults", () => {
  it("defaults missing or invalid values to on", () => {
    expect(normalizeReviewMode(undefined)).toBe("on");
    expect(normalizeReviewMode("invalid")).toBe("on");
    expect(normalizeReviewMode("on")).toBe("on");
    expect(normalizeReviewMode("off")).toBe("off");
  });
});
