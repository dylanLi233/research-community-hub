import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { integrationServiceErrorResponse } from "@/integrations/api-error";
import { createApiClient, listApiClients } from "@/integrations/service";
import {
  apiClientListQuerySchema,
  createApiClientSchema,
} from "@/integrations/validation";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const parsed = apiClientListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "查询参数格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const result = await listApiClients(authorization.db, parsed.data);

    return NextResponse.json(
      {
        data: {
          ...result,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          pageCount: Math.ceil(result.total / parsed.data.pageSize),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return integrationServiceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
    }

    const parsed = createApiClientSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "API Client 信息格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const client = await createApiClient(
      authorization.db,
      authorization.session.user.id,
      parsed.data,
    );

    return NextResponse.json(
      { data: { client } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return integrationServiceErrorResponse(error);
  }
}
