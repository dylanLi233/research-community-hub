import { describe, expect, it } from "vitest";

import {
  collectCourseAssetIds,
  validateChapterAssetReferences,
  validateCourseAssetReferences,
} from "./media-policy";
import { PAYWALL_MARKER } from "@/content/types";

const publicId = "123e4567-e89b-42d3-a456-426614174000";
const memberId = "223e4567-e89b-42d3-a456-426614174001";
const privateId = "323e4567-e89b-42d3-a456-426614174002";

const records = [
  { id: publicId, accessLevel: "public" as const, status: "active" as const },
  { id: memberId, accessLevel: "member" as const, status: "active" as const },
  { id: privateId, accessLevel: "private" as const, status: "active" as const },
];

describe("course asset policy", () => {
  it("collects cover and description media ids", () => {
    expect(
      collectCourseAssetIds({
        coverAssetId: publicId,
        descriptionHtml: `<img src="/media/${publicId}"><img src="/media/${memberId}">`,
      }),
    ).toEqual([publicId, memberId]);
  });

  it("requires public covers and public description images", () => {
    expect(
      validateCourseAssetReferences({
        coverAssetId: publicId,
        descriptionHtml: `<img src="/media/${publicId}">`,
        assets: records,
      }),
    ).toEqual([]);

    const issues = validateCourseAssetReferences({
      coverAssetId: memberId,
      descriptionHtml: `<img src="/media/${memberId}">`,
      assets: records,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "coverAssetId" }),
        expect.objectContaining({ field: "bodyHtml" }),
      ]),
    );
  });

  it("uses report-style paywall asset rules for chapters", () => {
    expect(
      validateChapterAssetReferences({
        bodyHtml: `<img src="/media/${publicId}">${PAYWALL_MARKER}<img src="/media/${memberId}">`,
        accessLevel: "member",
        previewMode: "paywall_marker",
        assets: records,
      }),
    ).toEqual([]);

    expect(
      validateChapterAssetReferences({
        bodyHtml: `<p>试读</p>${PAYWALL_MARKER}<img src="/media/${privateId}">`,
        accessLevel: "member",
        previewMode: "paywall_marker",
        assets: records,
      }),
    ).toEqual([
      expect.objectContaining({ code: "ASSET_ACCESS_MISMATCH" }),
    ]);
  });
});
