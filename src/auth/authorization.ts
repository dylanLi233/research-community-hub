import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { readSessionToken } from "./cookie";
import { findSessionByToken, type AuthenticatedSession } from "./session";
import { getDb, type AppDatabase } from "@/db/client";
import { apiError } from "@/lib/api-response";

export type AuthorizedRequest = {
  db: AppDatabase;
  session: AuthenticatedSession;
};

export type AuthorizationFailure = {
  response: ReturnType<typeof apiError>;
};

export async function requireRequestSession(
  request: NextRequest,
): Promise<AuthorizedRequest | AuthorizationFailure> {
  const token = readSessionToken(request);

  if (!token) {
    return {
      response: apiError("AUTHENTICATION_REQUIRED", "请先登录", 401),
    };
  }

  const db = await getDb();
  const session = await findSessionByToken(db, token);

  if (!session) {
    return {
      response: apiError(
        "AUTHENTICATION_REQUIRED",
        "登录状态已失效，请重新登录",
        401,
      ),
    };
  }

  if (session.user.mustChangePassword) {
    return {
      response: apiError(
        "PASSWORD_CHANGE_REQUIRED",
        "请先修改初始密码",
        403,
      ),
    };
  }

  return { db, session };
}

export async function requireAdminRequest(
  request: NextRequest,
): Promise<AuthorizedRequest | AuthorizationFailure> {
  const authorization = await requireRequestSession(request);

  if ("response" in authorization) {
    return authorization;
  }

  if (authorization.session.user.role !== "admin") {
    return {
      response: apiError("ADMIN_REQUIRED", "需要管理员权限", 403),
    };
  }

  return authorization;
}

export async function getServerSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("rch_session")?.value;

  if (!token) {
    return null;
  }

  const db = await getDb();
  return findSessionByToken(db, token);
}

export async function requireAdminPageSession(): Promise<AuthenticatedSession | null> {
  const session = await getServerSession();

  if (
    !session ||
    session.user.mustChangePassword ||
    session.user.role !== "admin"
  ) {
    return null;
  }

  return session;
}
