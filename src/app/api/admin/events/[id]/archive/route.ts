import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { eventServiceErrorResponse } from "@/events/api-error";
import { archiveAdminEvent } from "@/events/service";
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
    const event = await archiveAdminEvent(
      authorization.db,
      authorization.session.user.id,
      id,
    );

    return NextResponse.json(
      { data: { event } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return eventServiceErrorResponse(error);
  }
}
