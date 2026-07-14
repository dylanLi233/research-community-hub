import { describe, expect, it } from "vitest";

import {
  formDataString,
  importAssetMetadataSchema,
  MAX_ASSET_IMPORT_REQUEST_BYTES,
} from "./asset-validation";

describe("Hermes asset metadata", () => {
  it("accepts a stable external id and explicit access level", () => {
    expect(
      importAssetMetadataSchema.parse({
        externalId: "gs:ai-capex.chart_01-v2",
        accessLevel: "member",
        altText: "  AI 资本开支趋势图  ",
      }),
    ).toEqual({
      externalId: "gs:ai-capex.chart_01-v2",
      accessLevel: "member",
      altText: "AI 资本开支趋势图",
    });
  });

  it("normalizes blank alt text to null", () => {
    expect(
      importAssetMetadataSchema.parse({
        externalId: "cover-001",
        accessLevel: "public",
        altText: "   ",
      }).altText,
    ).toBeNull();
  });

  it("rejects whitespace, path separators and missing access level", () => {
    for (const externalId of ["has space", "../cover", "folder\\cover", ""] ) {
      expect(
        importAssetMetadataSchema.safeParse({
          externalId,
          accessLevel: "public",
        }).success,
      ).toBe(false);
    }

    expect(
      importAssetMetadataSchema.safeParse({ externalId: "cover-001" }).success,
    ).toBe(false);
  });

  it("reads only string form fields", () => {
    const formData = new FormData();
    formData.set("external_id", "cover-001");
    formData.set("file", new File([new Uint8Array([1])], "x.bin"));

    expect(formDataString(formData, "external_id")).toBe("cover-001");
    expect(formDataString(formData, "file")).toBeUndefined();
    expect(MAX_ASSET_IMPORT_REQUEST_BYTES).toBe(10.5 * 1024 * 1024);
  });
});
