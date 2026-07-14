import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/audit/write";
import { clearSessionCookie, readSessionToken } from "@/auth/cookie";
import { isSameOriginRequest } from "@/auth/origin";
import { findSessionByToken, revokeSessionByToken } from "@/auth/session";
import { getDb } from "@/db/client";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  const token = readSessionToken(request);
  const response = NextResponse.json(
    { data: { loggedOut: true } },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearSessionCookie(response);

  if (!token) {
    return response;
  }

  try {
    const db = await getDb();
    const session = await findSessionByToken(db, token);
    await revokeSessionByToken(db, token);

    if (session) {
      await writeAuditLog(db, {
        actorType: "user",
        actorId: session.user.id,
        action: "auth.logout",
        resourceType: "user",
        resourceId: session.user.id,
      });
    }

    return response;
  } catch (error) {
    console.error("Logout failed unexpectedly", error);
    return apiError("INTERNAL_ERROR", "退出登录暂时不可用", 500);
  }
}
