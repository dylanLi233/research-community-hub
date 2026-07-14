import { eq } from "drizzle-orm";

import {
  LOGIN_BLOCK_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
} from "./constants";
import { hashOpaqueToken } from "./token";
import type { AppDatabase } from "@/db/client";
import { authRateLimits } from "@/db/schema";

export type LoginRateState = {
  failureCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export type LoginRateDecision = {
  blocked: boolean;
  retryAfterSeconds: number | null;
};

export function evaluateLoginRateLimit(
  state: LoginRateState | null,
  now: Date,
): LoginRateDecision {
  if (!state?.blockedUntil || state.blockedUntil.getTime() <= now.getTime()) {
    return { blocked: false, retryAfterSeconds: null };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((state.blockedUntil.getTime() - now.getTime()) / 1000),
    ),
  };
}

export function nextLoginFailureState(
  state: LoginRateState | null,
  now: Date,
): LoginRateState {
  const windowExpired =
    !state || now.getTime() - state.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;
  const failureCount = windowExpired ? 1 : state.failureCount + 1;

  return {
    failureCount,
    windowStartedAt: windowExpired ? now : state.windowStartedAt,
    blockedUntil:
      failureCount >= LOGIN_MAX_FAILURES
        ? new Date(now.getTime() + LOGIN_BLOCK_MS)
        : null,
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function createLoginRateKey(
  normalizedUsername: string,
  request: Request,
): Promise<string> {
  return hashOpaqueToken(`${normalizedUsername}\u0000${getClientIp(request)}`);
}

export async function readLoginRateState(
  db: AppDatabase,
  keyHash: string,
): Promise<LoginRateState | null> {
  const row = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.keyHash, keyHash),
  });

  if (!row) {
    return null;
  }

  return {
    failureCount: row.failureCount,
    windowStartedAt: row.windowStartedAt,
    blockedUntil: row.blockedUntil,
  };
}

export async function recordLoginFailure(
  db: AppDatabase,
  keyHash: string,
  now: Date,
): Promise<LoginRateState> {
  const current = await readLoginRateState(db, keyHash);
  const next = nextLoginFailureState(current, now);

  await db
    .insert(authRateLimits)
    .values({
      keyHash,
      failureCount: next.failureCount,
      windowStartedAt: next.windowStartedAt,
      blockedUntil: next.blockedUntil,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: authRateLimits.keyHash,
      set: {
        failureCount: next.failureCount,
        windowStartedAt: next.windowStartedAt,
        blockedUntil: next.blockedUntil,
        updatedAt: now,
      },
    });

  return next;
}

export async function clearLoginFailures(
  db: AppDatabase,
  keyHash: string,
): Promise<void> {
  await db.delete(authRateLimits).where(eq(authRateLimits.keyHash, keyHash));
}
