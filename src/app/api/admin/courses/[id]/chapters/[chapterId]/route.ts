import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { courseServiceErrorResponse } from "@/courses/api-error";
import { getAdminChapter, updateAdminChapter } from "@/courses/service";
import { updateAdminChapterSchema } from "@/courses/validation";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; chapterId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const { id, chapterId } = await context.params;
    const chapter = await getAdminChapter(authorization.db, id, chapterId);

    return NextResponse.json(
      { data: { chapter } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return courseServiceErrorResponse(error);
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

    const parsed = updateAdminChapterSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "章节信息格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const { id, chapterId } = await context.params;
    const result = await updateAdminChapter(
      authorization.db,
      authorization.session.user.id,
      id,
      chapterId,
      parsed.data,
    );

    return NextResponse.json(
      { data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return courseServiceErrorResponse(error);
  }
}
