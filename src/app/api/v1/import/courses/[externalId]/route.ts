import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportedCourseSummary } from "@/imports/course-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requireApiClientRequest(request, "imports:read");
  if ("response" in authorization) return authorization.response;

  const { externalId } = await context.params;
  const course = await getImportedCourseSummary(
    authorization.db,
    authorization.client.id,
    externalId,
  );

  if (!course) {
    return apiError("COURSE_NOT_FOUND", "课程不存在", 404);
  }

  return NextResponse.json(
    { data: { course } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
