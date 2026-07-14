export type ExistingImportedAsset = {
  status: "active" | "deleted";
  sha256: string;
  accessLevel: "public" | "member" | "private";
  altText: string | null;
};

export type AssetImportDecision =
  | { action: "created" }
  | { action: "unchanged" }
  | { action: "conflict"; code: "ASSET_EXTERNAL_ID_CONFLICT" }
  | { action: "conflict"; code: "ASSET_EXTERNAL_ID_DELETED" };

export function decideAssetImport(input: {
  existing: ExistingImportedAsset | null;
  sha256: string;
  accessLevel: "public" | "member" | "private";
  altText: string | null;
}): AssetImportDecision {
  if (!input.existing) {
    return { action: "created" };
  }

  if (input.existing.status === "deleted") {
    return { action: "conflict", code: "ASSET_EXTERNAL_ID_DELETED" };
  }

  const unchanged =
    input.existing.sha256 === input.sha256 &&
    input.existing.accessLevel === input.accessLevel &&
    input.existing.altText === input.altText;

  return unchanged
    ? { action: "unchanged" }
    : { action: "conflict", code: "ASSET_EXTERNAL_ID_CONFLICT" };
}
