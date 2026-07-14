import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { integrationServiceErrorResponse } from "@/integrations/api-error";
import { createApiToken, listApiTokens } from "@/integrations/service";
import { createApiTokenSchema } from "@/integrations/validation";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const { id } = await context.params;
    const tokens = await listApiTokens(authorization.db, id);

    return NextResponse.json(
      { data: { tokens } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return integrationServiceErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    let body: unknown = {};

    if (request.headers.get("content-length") !== "0") {
      try {
        body = await request.json();
      } catch {
        return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
      }
    }

    const parsed = createApiTokenSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "Token 信息格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const { id } = await context.params;
    const result = await createApiToken(
      authorization.db,
      authorization.session.user.id,
      id,
      parsed.data,
    );

    return NextResponse.json(
      { data: result },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return integrationServiceErrorResponse(error);
  }
}
