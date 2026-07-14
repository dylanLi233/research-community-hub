import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { adminServiceErrorResponse } from "@/admin/api-error";
import { revokeAdminUserSessions } from "@/admin/user-service";
import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
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

    const { id } = await context.params;
    await revokeAdminUserSessions(
      authorization.db,
      authorization.session.user.id,
      id,
    );

    return NextResponse.json(
      { data: { revoked: true } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminServiceErrorResponse(error);
  }
}
