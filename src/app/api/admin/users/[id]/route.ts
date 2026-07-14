import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { adminServiceErrorResponse } from "@/admin/api-error";
import {
  getAdminUserById,
  updateAdminUser,
} from "@/admin/user-service";
import { updateAdminUserSchema } from "@/admin/user-validation";
import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
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
    const user = await getAdminUserById(authorization.db, id);

    if (!user) {
      return apiError("USER_NOT_FOUND", "用户不存在", 404);
    }

    return NextResponse.json(
      { data: { user } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminServiceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const parsed = updateAdminUserSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "用户信息格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const { id } = await context.params;
    const user = await updateAdminUser(
      authorization.db,
      authorization.session.user.id,
      id,
      parsed.data,
    );

    return NextResponse.json(
      { data: { user } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminServiceErrorResponse(error);
  }
}
