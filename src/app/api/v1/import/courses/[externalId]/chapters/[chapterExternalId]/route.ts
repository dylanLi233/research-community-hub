import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportedChapterSummary } from "@/imports/course-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    externalId: string;
    chapterExternalId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requireApiClientRequest(request, "imports:read");
  if ("response" in authorization) return authorization.response;

  const { externalId, chapterExternalId } = await context.params;
  const chapter = await getImportedChapterSummary(
    authorization.db,
    authorization.client.id,
    externalId,
    chapterExternalId,
  );

  if (!chapter) {
    return apiError("CHAPTER_NOT_FOUND", "章节不存在", 404);
  }

  return NextResponse.json(
    { data: { chapter } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
