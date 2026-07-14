import { describe, expect, it } from "vitest";

import {
  extractMediaAssetIds,
  reportBodyAssetRequirements,
  validateReportAssetReferences,
} from "./media-policy";
import { PAYWALL_MARKER } from "@/content/types";

const publicId = "123e4567-e89b-42d3-a456-426614174000";
const memberId = "223e4567-e89b-42d3-a456-426614174001";
const privateId = "323e4567-e89b-42d3-a456-426614174002";
const missingId = "423e4567-e89b-42d3-a456-426614174003";

const rows = [
  { id: publicId, accessLevel: "public" as const, status: "active" as const },
  { id: memberId, accessLevel: "member" as const, status: "active" as const },
  { id: privateId, accessLevel: "private" as const, status: "active" as const },
];

describe("report media policy", () => {
  it("extracts unique media UUIDs in document order", () => {
    expect(
      extractMediaAssetIds(
        `<img src="/media/${publicId}"><img src="/media/${memberId}"><img src="/media/${publicId}">`,
      ),
    ).toEqual([publicId, memberId]);
  });

  it("requires public assets before the paywall and member-safe assets after it", () => {
    const requirements = reportBodyAssetRequirements({
      bodyHtml: `<img src="/media/${publicId}">${PAYWALL_MARKER}<img src="/media/${memberId}">`,
      accessLevel: "member",
      previewMode: "paywall_marker",
    });

    expect(requirements.get(publicId)).toBe("public");
    expect(requirements.get(memberId)).toBe("member_or_public");
  });

  it("accepts valid public and member references", () => {
    expect(
      validateReportAssetReferences({
        coverAssetId: publicId,
        bodyHtml: `<img src="/media/${publicId}">${PAYWALL_MARKER}<img src="/media/${memberId}">`,
        accessLevel: "member",
        previewMode: "paywall_marker",
        assets: rows,
      }),
    ).toEqual([]);
  });

  it("rejects non-public covers and private assets in member content", () => {
    const issues = validateReportAssetReferences({
      coverAssetId: memberId,
      bodyHtml: `<p>试读</p>${PAYWALL_MARKER}<img src="/media/${privateId}">`,
      accessLevel: "member",
      previewMode: "paywall_marker",
      assets: rows,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "coverAssetId",
          code: "ASSET_ACCESS_MISMATCH",
        }),
        expect.objectContaining({
          field: "bodyHtml",
          code: "ASSET_ACCESS_MISMATCH",
        }),
      ]),
    );
  });

  it("rejects missing or deleted references", () => {
    const issues = validateReportAssetReferences({
      coverAssetId: null,
      bodyHtml: `<img src="/media/${missingId}">`,
      accessLevel: "public",
      previewMode: "none",
      assets: rows,
    });

    expect(issues).toEqual([
      expect.objectContaining({ code: "ASSET_NOT_FOUND", assetId: missingId }),
    ]);
  });

  it("allows private reports to reference any active asset level", () => {
    expect(
      validateReportAssetReferences({
        coverAssetId: null,
        bodyHtml: `<img src="/media/${privateId}">`,
        accessLevel: "private",
        previewMode: "none",
        assets: rows,
      }),
    ).toEqual([]);
  });
});
