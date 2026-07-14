import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getImportedEventSummary } from "@/imports/event-service";
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
  const event = await getImportedEventSummary(
    authorization.db,
    authorization.client.id,
    externalId,
  );

  if (!event) {
    return apiError("EVENT_NOT_FOUND", "事件不存在", 404);
  }

  return NextResponse.json(
    { data: { event } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
