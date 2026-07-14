import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { adminServiceErrorResponse } from "@/admin/api-error";
import { resetAdminUserPassword } from "@/admin/user-service";
import { resetPasswordSchema } from "@/admin/user-validation";
import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { apiError, validationDetails } from "@/lib/api-response";

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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
    }

    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "密码格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const { id } = await context.params;
    await resetAdminUserPassword(
      authorization.db,
      authorization.session.user.id,
      id,
      parsed.data.password,
    );

    return NextResponse.json(
      { data: { reset: true } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminServiceErrorResponse(error);
  }
}
