import { PAYWALL_MARKER, type ContentAccessLevel, type ContentPreviewMode } from "@/content/types";

const MEDIA_REFERENCE_PATTERN =
  /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export type ReportAssetRecord = {
  id: string;
  accessLevel: "public" | "member" | "private";
  status: "active" | "deleted";
};

export type ReportAssetIssue = {
  field: "coverAssetId" | "bodyHtml";
  code: "ASSET_NOT_FOUND" | "ASSET_ACCESS_MISMATCH";
  message: string;
  assetId: string;
};

type RequiredAssetAccess = "public" | "member_or_public" | "any_active";

export function extractMediaAssetIds(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(MEDIA_REFERENCE_PATTERN)) {
    const id = match[1]?.toLowerCase();

    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

function strongestRequirement(
  current: RequiredAssetAccess | undefined,
  next: RequiredAssetAccess,
): RequiredAssetAccess {
  const rank: Record<RequiredAssetAccess, number> = {
    any_active: 0,
    member_or_public: 1,
    public: 2,
  };

  return !current || rank[next] > rank[current] ? next : current;
}

export function reportBodyAssetRequirements(input: {
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
}): Map<string, RequiredAssetAccess> {
  const requirements = new Map<string, RequiredAssetAccess>();

  const add = (html: string, requirement: RequiredAssetAccess) => {
    for (const id of extractMediaAssetIds(html)) {
      requirements.set(
        id,
        strongestRequirement(requirements.get(id), requirement),
      );
    }
  };

  if (input.accessLevel === "public") {
    add(input.bodyHtml, "public");
    return requirements;
  }

  if (input.accessLevel === "private") {
    add(input.bodyHtml, "any_active");
    return requirements;
  }

  if (input.previewMode === "paywall_marker") {
    const [publicHtml, memberHtml = ""] = input.bodyHtml.split(PAYWALL_MARKER);
    add(publicHtml, "public");
    add(memberHtml, "member_or_public");
    return requirements;
  }

  add(input.bodyHtml, "member_or_public");
  return requirements;
}

function satisfiesAccess(
  actual: ReportAssetRecord["accessLevel"],
  required: RequiredAssetAccess,
): boolean {
  if (required === "any_active") {
    return true;
  }

  if (required === "public") {
    return actual === "public";
  }

  return actual === "public" || actual === "member";
}

export function validateReportAssetReferences(input: {
  coverAssetId: string | null;
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
  assets: ReportAssetRecord[];
}): ReportAssetIssue[] {
  const issues: ReportAssetIssue[] = [];
  const assetById = new Map(input.assets.map((asset) => [asset.id.toLowerCase(), asset]));

  if (input.coverAssetId) {
    const coverId = input.coverAssetId.toLowerCase();
    const cover = assetById.get(coverId);

    if (!cover || cover.status !== "active") {
      issues.push({
        field: "coverAssetId",
        code: "ASSET_NOT_FOUND",
        message: "封面素材不存在或已失效",
        assetId: input.coverAssetId,
      });
    } else if (cover.accessLevel !== "public") {
      issues.push({
        field: "coverAssetId",
        code: "ASSET_ACCESS_MISMATCH",
        message: "封面素材必须设置为 public",
        assetId: input.coverAssetId,
      });
    }
  }

  for (const [assetId, requirement] of reportBodyAssetRequirements(input)) {
    const asset = assetById.get(assetId);

    if (!asset || asset.status !== "active") {
      issues.push({
        field: "bodyHtml",
        code: "ASSET_NOT_FOUND",
        message: `正文引用的素材 ${assetId} 不存在或已失效`,
        assetId,
      });
      continue;
    }

    if (!satisfiesAccess(asset.accessLevel, requirement)) {
      issues.push({
        field: "bodyHtml",
        code: "ASSET_ACCESS_MISMATCH",
        message: `正文素材 ${assetId} 的访问级别与内容展示范围不匹配`,
        assetId,
      });
    }
  }

  return issues;
}
