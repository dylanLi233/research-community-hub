import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { getReviewMode, setReviewMode } from "@/integrations/review-mode";
import { reviewModeSchema } from "@/integrations/validation";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const mode = await getReviewMode(authorization.db);

    return NextResponse.json(
      { data: { mode } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to read review mode", error);
    return apiError("INTERNAL_ERROR", "审核模式读取失败", 500);
  }
}

export async function PATCH(request: NextRequest) {
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

    const parsed = reviewModeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "审核模式格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const mode = await setReviewMode(
      authorization.db,
      authorization.session.user.id,
      parsed.data.mode,
    );

    return NextResponse.json(
      { data: { mode } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to update review mode", error);
    return apiError("INTERNAL_ERROR", "审核模式更新失败", 500);
  }
}
