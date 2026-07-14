import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportedReportSummary } from "@/imports/report-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requireApiClientRequest(request, "imports:read");

  if ("response" in authorization) {
    return authorization.response;
  }

  const { externalId } = await context.params;
  const report = await getImportedReportSummary(
    authorization.db,
    authorization.client.id,
    externalId,
  );

  if (!report) {
    return apiError("REPORT_NOT_FOUND", "研报不存在", 404);
  }

  return NextResponse.json(
    { data: { report } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
