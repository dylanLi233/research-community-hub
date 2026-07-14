import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { integrationServiceErrorResponse } from "@/integrations/api-error";
import { revokeApiToken } from "@/integrations/service";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; tokenId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const { id, tokenId } = await context.params;
    const token = await revokeApiToken(
      authorization.db,
      authorization.session.user.id,
      id,
      tokenId,
    );

    return NextResponse.json(
      { data: { token } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return integrationServiceErrorResponse(error);
  }
}
