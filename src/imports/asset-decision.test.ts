import { describe, expect, it } from "vitest";

import { decideAssetImport } from "./asset-decision";

const existing = {
  status: "active" as const,
  sha256: "a".repeat(64),
  accessLevel: "member" as const,
  altText: "图表说明",
};

describe("asset import decision", () => {
  it("creates when external_id does not exist", () => {
    expect(
      decideAssetImport({
        existing: null,
        sha256: "a".repeat(64),
        accessLevel: "member",
        altText: "图表说明",
      }),
    ).toEqual({ action: "created" });
  });

  it("returns unchanged for identical immutable content and metadata", () => {
    expect(
      decideAssetImport({
        existing,
        sha256: existing.sha256,
        accessLevel: existing.accessLevel,
        altText: existing.altText,
      }),
    ).toEqual({ action: "unchanged" });
  });

  it("rejects changed bytes, access level or alt text", () => {
    for (const change of [
      { sha256: "b".repeat(64) },
      { accessLevel: "public" as const },
      { altText: "新的说明" },
    ]) {
      expect(
        decideAssetImport({
          existing,
          sha256: existing.sha256,
          accessLevel: existing.accessLevel,
          altText: existing.altText,
          ...change,
        }),
      ).toEqual({
        action: "conflict",
        code: "ASSET_EXTERNAL_ID_CONFLICT",
      });
    }
  });

  it("never automatically reuses a deleted external_id", () => {
    expect(
      decideAssetImport({
        existing: { ...existing, status: "deleted" },
        sha256: existing.sha256,
        accessLevel: existing.accessLevel,
        altText: existing.altText,
      }),
    ).toEqual({
      action: "conflict",
      code: "ASSET_EXTERNAL_ID_DELETED",
    });
  });
});
