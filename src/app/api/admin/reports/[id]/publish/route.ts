import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { apiError } from "@/lib/api-response";
import { reportServiceErrorResponse } from "@/reports/api-error";
import { publishAdminReport } from "@/reports/service";

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
    const report = await publishAdminReport(
      authorization.db,
      authorization.session.user.id,
      id,
    );

    return NextResponse.json(
      { data: { report } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return reportServiceErrorResponse(error);
  }
}
