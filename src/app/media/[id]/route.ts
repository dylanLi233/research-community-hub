import type { NextRequest } from "next/server";

import { canAccessAsset } from "@/assets/access";
import { getActiveAssetRecord } from "@/assets/service";
import { getMediaBucket } from "@/assets/storage";
import { resolveAssetViewer } from "@/assets/viewer";
import { getDb } from "@/db/client";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function notFoundResponse() {
  return apiError("ASSET_NOT_FOUND", "素材不存在", 404);
}

function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) {
    return false;
  }

  return header
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const asset = await getActiveAssetRecord(db, id);

    if (!asset) {
      return notFoundResponse();
    }

    const viewer = await resolveAssetViewer(db, request);

    if (!canAccessAsset(asset.accessLevel, viewer)) {
      return notFoundResponse();
    }

    const bucket = await getMediaBucket();
    const object = await bucket.get(asset.storageKey);

    if (!object) {
      return notFoundResponse();
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", asset.mimeType);
    headers.set("Content-Length", String(object.size));
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");

    if (asset.accessLevel === "public") {
      headers.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
    } else {
      headers.set("Cache-Control", "private, no-store");
      headers.set("Vary", "Cookie");
    }

    if (matchesIfNoneMatch(request.headers.get("if-none-match"), object.httpEtag)) {
      headers.delete("Content-Length");
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error("Failed to read asset", error);
    return apiError("ASSET_READ_FAILED", "素材读取失败", 500);
  }
}
