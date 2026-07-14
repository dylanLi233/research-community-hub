import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import type { AssetViewer } from "./access";
import { readSessionToken } from "@/auth/cookie";
import { findSessionByToken } from "@/auth/session";
import type { AppDatabase } from "@/db/client";
import { memberships } from "@/db/schema";
import { evaluateMembership } from "@/membership/policy";

export async function resolveAssetViewer(
  db: AppDatabase,
  request: NextRequest,
): Promise<AssetViewer> {
  const token = readSessionToken(request);

  if (!token) {
    return null;
  }

  const session = await findSessionByToken(db, token);

  if (!session || session.user.mustChangePassword) {
    return null;
  }

  if (session.user.role === "admin") {
    return {
      role: "admin",
      membership: { state: "none", hasMemberAccess: false },
    };
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, session.user.id),
  });

  return {
    role: "member",
    membership: evaluateMembership({
      accountStatus: "active",
      membership: membership
        ? {
            status: membership.status,
            startsAt: membership.startsAt,
            expiresAt: membership.expiresAt,
          }
        : null,
    }),
  };
}
