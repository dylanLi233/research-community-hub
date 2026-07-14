import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportedAssetSummary } from "@/imports/asset-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requireApiClientRequest(request, "imports:read");

  if ("response" in authorization) {
    return authorization.response;
  }

  const { externalId } = await context.params;
  const asset = await getImportedAssetSummary(
    authorization.db,
    authorization.client.id,
    externalId,
  );

  if (!asset) {
    return apiError("ASSET_NOT_FOUND", "素材不存在", 404);
  }

  return NextResponse.json(
    { data: { asset } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
