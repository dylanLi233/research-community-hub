export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export const ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];
export type AssetAccessLevel = "public" | "member" | "private";

export const ASSET_EXTENSION_BY_MIME: Record<AssetMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
