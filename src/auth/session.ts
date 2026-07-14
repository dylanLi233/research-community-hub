import { and, eq, gt, isNull } from "drizzle-orm";

import { SESSION_TTL_SECONDS } from "./constants";
import { generateId, generateOpaqueToken, hashOpaqueToken } from "./token";
import type { AppDatabase } from "@/db/client";
import { sessions, users } from "@/db/schema";

export type SafeUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "member" | "admin";
  mustChangePassword: boolean;
};

export type AuthenticatedSession = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  user: SafeUser;
};

export type CreatedSession = {
  token: string;
  expiresAt: Date;
};

export async function createSession(
  db: AppDatabase,
  userId: string,
  now = new Date(),
): Promise<CreatedSession> {
  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    id: generateId(),
    userId,
    tokenHash,
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
  });

  return { token, expiresAt };
}

export async function findSessionByToken(
  db: AppDatabase,
  token: string,
  now = new Date(),
): Promise<AuthenticatedSession | null> {
  const tokenHash = await hashOpaqueToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      tokenHash: sessions.tokenHash,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.sessionId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      mustChangePassword: row.mustChangePassword,
    },
  };
}

export async function revokeSessionByToken(
  db: AppDatabase,
  token: string,
  now = new Date(),
): Promise<void> {
  const tokenHash = await hashOpaqueToken(token);

  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(
  db: AppDatabase,
  userId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
