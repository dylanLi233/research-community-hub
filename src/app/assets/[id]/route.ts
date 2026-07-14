import type { NextRequest } from "next/server";

import {
  getAssetsBucket,
  getPublicAssetRecord,
} from "@/assets/service";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const asset = await getPublicAssetRecord(db, id);

    if (!asset) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const bucket = await getAssetsBucket();
    const object = await bucket.get(asset.storageKey);

    if (!object) {
      console.error("Active asset metadata points to a missing R2 object", {
        assetId: asset.id,
        storageKey: asset.storageKey,
      });
      return new Response("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const etag = object.httpEtag;

    if (request.headers.get("If-None-Match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", asset.mimeType);
    headers.set("Content-Length", object.size.toString());
    headers.set("ETag", etag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Public asset read failed", error);
    return new Response("Service Unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
