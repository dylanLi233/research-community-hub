import { describe, expect, it } from "vitest";

import { canAccessAsset, type AssetViewer } from "./access";

const memberViewer = (
  hasMemberAccess: boolean,
  state: "active" | "expired" = hasMemberAccess ? "active" : "expired",
): AssetViewer => ({
  role: "member",
  membership: { state, hasMemberAccess },
});

const adminViewer: AssetViewer = {
  role: "admin",
  membership: { state: "none", hasMemberAccess: false },
};

describe("asset access policy", () => {
  it("allows public assets without a session", () => {
    expect(canAccessAsset("public", null)).toBe(true);
  });

  it("allows active members to read member assets", () => {
    expect(canAccessAsset("member", memberViewer(true))).toBe(true);
  });

  it("rejects anonymous and expired members for member assets", () => {
    expect(canAccessAsset("member", null)).toBe(false);
    expect(canAccessAsset("member", memberViewer(false))).toBe(false);
  });

  it("allows administrators to read all asset levels", () => {
    expect(canAccessAsset("public", adminViewer)).toBe(true);
    expect(canAccessAsset("member", adminViewer)).toBe(true);
    expect(canAccessAsset("private", adminViewer)).toBe(true);
  });

  it("rejects normal members for private assets", () => {
    expect(canAccessAsset("private", memberViewer(true))).toBe(false);
  });
});
