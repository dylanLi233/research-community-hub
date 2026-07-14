import {
  extractMediaAssetIds,
  validateReportAssetReferences,
  type ReportAssetIssue,
  type ReportAssetRecord,
} from "@/reports/media-policy";

export function collectCourseAssetIds(input: {
  coverAssetId: string | null;
  descriptionHtml: string;
}): string[] {
  const ids = new Set(extractMediaAssetIds(input.descriptionHtml));

  if (input.coverAssetId) {
    ids.add(input.coverAssetId.toLowerCase());
  }

  return [...ids];
}

export function validateCourseAssetReferences(input: {
  coverAssetId: string | null;
  descriptionHtml: string;
  assets: ReportAssetRecord[];
}): ReportAssetIssue[] {
  return validateReportAssetReferences({
    coverAssetId: input.coverAssetId,
    bodyHtml: input.descriptionHtml,
    accessLevel: "public",
    previewMode: "none",
    assets: input.assets,
  });
}

export function validateChapterAssetReferences(input: {
  bodyHtml: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  assets: ReportAssetRecord[];
}): ReportAssetIssue[] {
  return validateReportAssetReferences({
    coverAssetId: null,
    bodyHtml: input.bodyHtml,
    accessLevel: input.accessLevel,
    previewMode: input.previewMode,
    assets: input.assets,
  });
}
