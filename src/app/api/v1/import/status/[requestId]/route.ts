import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportStatus } from "@/imports/log-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requireApiClientRequest(request, "imports:read");

  if ("response" in authorization) {
    return authorization.response;
  }

  const { requestId } = await context.params;
  const result = await getImportStatus(
    authorization.db,
    authorization.client.id,
    requestId,
  );

  if (!result) {
    return apiError("IMPORT_REQUEST_NOT_FOUND", "导入请求不存在", 404);
  }

  return NextResponse.json(
    {
      data: {
        request_id: result.requestId,
        original_http_status: result.httpStatus,
        response: result.body,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
