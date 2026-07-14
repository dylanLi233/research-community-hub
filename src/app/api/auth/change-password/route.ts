import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/audit/write";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "@/auth/cookie";
import { isSameOriginRequest } from "@/auth/origin";
import { hashPassword, verifyPassword } from "@/auth/password";
import {
  createSession,
  findSessionByToken,
  revokeAllUserSessions,
} from "@/auth/session";
import { changePasswordSchema } from "@/auth/validation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  const token = readSessionToken(request);

  if (!token) {
    return apiError("AUTHENTICATION_REQUIRED", "请先登录", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
  }

  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "密码信息格式不正确", 400, {
      details: validationDetails(parsed.error.issues),
    });
  }

  try {
    const db = await getDb();
    const session = await findSessionByToken(db, token);

    if (!session) {
      const response = apiError(
        "AUTHENTICATION_REQUIRED",
        "登录状态已失效，请重新登录",
        401,
      );
      clearSessionCookie(response);
      return response;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (
      !user ||
      !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))
    ) {
      return apiError(
        "CURRENT_PASSWORD_INVALID",
        "当前密码不正确",
        400,
      );
    }

    const now = new Date();
    const newPasswordHash = await hashPassword(parsed.data.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    await revokeAllUserSessions(db, user.id, now);
    const newSession = await createSession(db, user.id, now);

    await writeAuditLog(db, {
      actorType: "user",
      actorId: user.id,
      action: "auth.password_changed",
      resourceType: "user",
      resourceId: user.id,
    });

    const response = NextResponse.json(
      {
        data: {
          changed: true,
          user: {
            ...session.user,
            mustChangePassword: false,
          },
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    setSessionCookie(response, newSession.token, newSession.expiresAt);
    return response;
  } catch (error) {
    console.error("Password change failed unexpectedly", error);
    return apiError("INTERNAL_ERROR", "修改密码暂时不可用", 500);
  }
}
