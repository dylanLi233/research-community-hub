import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { AssetMimeType } from "./constants";

export async function getMediaBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.MEDIA_BUCKET) {
    throw new Error("Cloudflare R2 binding MEDIA_BUCKET is not configured");
  }

  return env.MEDIA_BUCKET;
}

export function buildAssetStorageKey(
  assetId: string,
  extension: string,
  now = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `assets/${year}/${month}/${assetId}.${extension}`;
}

export async function storeAssetObject(
  bucket: R2Bucket,
  input: {
    key: string;
    bytes: ArrayBuffer;
    mimeType: AssetMimeType;
    assetId: string;
    originalFilename: string;
    sha256: string;
  },
): Promise<R2Object> {
  const object = await bucket.put(input.key, input.bytes, {
    httpMetadata: {
      contentType: input.mimeType,
      cacheControl: "private, no-store",
      contentDisposition: "inline",
    },
    customMetadata: {
      assetId: input.assetId,
      originalFilename: input.originalFilename,
      sha256: input.sha256,
    },
  });

  if (!object) {
    throw new Error("R2 rejected the asset upload");
  }

  return object;
}
