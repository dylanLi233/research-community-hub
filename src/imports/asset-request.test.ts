import { describe, expect, it } from "vitest";

import { hashAssetImportRequest } from "./asset-request";

const metadata = {
  externalId: "gs-ai-capex-chart-01",
  accessLevel: "member" as const,
  altText: "AI 资本开支趋势图",
};

describe("asset import request hash", () => {
  it("is stable for identical normalized metadata and file content", async () => {
    const first = await hashAssetImportRequest({
      metadata,
      fileSha256: "a".repeat(64),
    });
    const second = await hashAssetImportRequest({
      metadata: { ...metadata },
      fileSha256: "a".repeat(64),
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("changes when immutable bytes or metadata change", async () => {
    const base = await hashAssetImportRequest({
      metadata,
      fileSha256: "a".repeat(64),
    });
    const changedFile = await hashAssetImportRequest({
      metadata,
      fileSha256: "b".repeat(64),
    });
    const changedAccess = await hashAssetImportRequest({
      metadata: { ...metadata, accessLevel: "public" },
      fileSha256: "a".repeat(64),
    });
    const changedAlt = await hashAssetImportRequest({
      metadata: { ...metadata, altText: "新说明" },
      fileSha256: "a".repeat(64),
    });

    expect(changedFile).not.toBe(base);
    expect(changedAccess).not.toBe(base);
    expect(changedAlt).not.toBe(base);
  });
});
