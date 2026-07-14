import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clearSessionCookie, readSessionToken } from "@/auth/cookie";
import { findSessionByToken } from "@/auth/session";
import { getDb } from "@/db/client";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = readSessionToken(request);

  if (!token) {
    return NextResponse.json(
      { data: { authenticated: false, user: null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const db = await getDb();
    const session = await findSessionByToken(db, token);

    if (!session) {
      const response = NextResponse.json(
        { data: { authenticated: false, user: null } },
        { headers: { "Cache-Control": "no-store" } },
      );
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json(
      {
        data: {
          authenticated: true,
          user: session.user,
          expiresAt: session.expiresAt.toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Session lookup failed", error);
    return apiError("INTERNAL_ERROR", "会话查询暂时不可用", 500);
  }
}
