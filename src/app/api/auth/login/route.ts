import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/audit/write";
import { clearSessionCookie, setSessionCookie } from "@/auth/cookie";
import { DUMMY_PASSWORD_HASH } from "@/auth/constants";
import { isSameOriginRequest } from "@/auth/origin";
import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "@/auth/password";
import {
  clearLoginFailures,
  createLoginRateKey,
  evaluateLoginRateLimit,
  readLoginRateState,
  recordLoginFailure,
} from "@/auth/rate-limit";
import { createSession, type SafeUser } from "@/auth/session";
import {
  loginSchema,
  normalizeUsername,
  safeReturnTo,
} from "@/auth/validation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "登录信息格式不正确", 400, {
      details: validationDetails(parsed.error.issues),
    });
  }

  const now = new Date();
  const normalizedUsername = normalizeUsername(parsed.data.username);

  try {
    const db = await getDb();
    const rateKey = await createLoginRateKey(normalizedUsername, request);
    const rateState = await readLoginRateState(db, rateKey);
    const rateDecision = evaluateLoginRateLimit(rateState, now);

    if (rateDecision.blocked && rateDecision.retryAfterSeconds) {
      return apiError("RATE_LIMITED", "登录尝试过于频繁，请稍后再试", 429, {
        headers: {
          "Retry-After": rateDecision.retryAfterSeconds.toString(),
        },
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.usernameNormalized, normalizedUsername),
    });
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const accepted = Boolean(
      user && user.status === "active" && passwordMatches,
    );

    if (!accepted || !user) {
      await recordLoginFailure(db, rateKey, now);
      await writeAuditLog(db, {
        actorType: "system",
        action: "auth.login_failed",
        resourceType: "authentication",
        metadata: { rateKey },
      });

      const response = apiError(
        "INVALID_CREDENTIALS",
        "用户名或密码错误",
        401,
      );
      clearSessionCookie(response);
      return response;
    }

    await clearLoginFailures(db, rateKey);

    const passwordUpgrade = passwordHashNeedsUpgrade(user.passwordHash)
      ? hashPassword(parsed.data.password)
      : null;
    const session = await createSession(db, user.id, now);

    await db
      .update(users)
      .set({
        lastLoginAt: now,
        updatedAt: now,
        ...(passwordUpgrade
          ? {
              passwordHash: await passwordUpgrade,
              passwordChangedAt: now,
            }
          : {}),
      })
      .where(eq(users.id, user.id));

    await writeAuditLog(db, {
      actorType: "user",
      actorId: user.id,
      action: "auth.login_succeeded",
      resourceType: "user",
      resourceId: user.id,
    });

    const safeUser: SafeUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    const returnTo = user.mustChangePassword
      ? "/account/password"
      : safeReturnTo(parsed.data.returnTo);
    const response = NextResponse.json(
      { data: { user: safeUser, returnTo } },
      { headers: { "Cache-Control": "no-store" } },
    );

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error("Login failed unexpectedly", error);
    return apiError("INTERNAL_ERROR", "登录暂时不可用", 500);
  }
}
