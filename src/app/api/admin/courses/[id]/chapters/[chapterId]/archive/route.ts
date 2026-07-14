import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { courseServiceErrorResponse } from "@/courses/api-error";
import { archiveAdminChapter } from "@/courses/service";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; chapterId: string }>;
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

    const { id, chapterId } = await context.params;
    const chapter = await archiveAdminChapter(
      authorization.db,
      authorization.session.user.id,
      id,
      chapterId,
    );

    return NextResponse.json(
      { data: { chapter } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return courseServiceErrorResponse(error);
  }
}
