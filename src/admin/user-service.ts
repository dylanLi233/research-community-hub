import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  or,
  type SQL,
} from "drizzle-orm";

import type {
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "./user-validation";
import { writeAuditLog } from "@/audit/write";
import { hashPassword } from "@/auth/password";
import { generateId } from "@/auth/token";
import { normalizeUsername } from "@/auth/validation";
import type { AppDatabase } from "@/db/client";
import { memberships, sessions, users } from "@/db/schema";
import {
  evaluateMembership,
  type MembershipDecision,
} from "@/membership/policy";

export class AdminUserServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdminUserServiceError";
  }
}

export type AdminMembershipView = {
  status: "active" | "inactive";
  startsAt: string;
  expiresAt: string | null;
  note: string | null;
  state: MembershipDecision["state"];
  hasMemberAccess: boolean;
};

export type AdminUserView = {
  id: string;
  username: string;
  displayName: string | null;
  role: "member" | "admin";
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  membership: AdminMembershipView | null;
};

type UserMembershipRow = {
  id: string;
  username: string;
  displayName: string | null;
  role: "member" | "admin";
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  membershipStatus: "active" | "inactive" | null;
  membershipStartsAt: Date | null;
  membershipExpiresAt: Date | null;
  membershipNote: string | null;
};

function toAdminUserView(
  row: UserMembershipRow,
  now = new Date(),
): AdminUserView {
  const membership =
    row.membershipStatus && row.membershipStartsAt
      ? {
          status: row.membershipStatus,
          startsAt: row.membershipStartsAt,
          expiresAt: row.membershipExpiresAt,
        }
      : null;
  const decision = evaluateMembership(
    {
      accountStatus: row.status,
      membership,
    },
    now,
  );

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    membership: membership
      ? {
          status: membership.status,
          startsAt: membership.startsAt.toISOString(),
          expiresAt: membership.expiresAt?.toISOString() ?? null,
          note: row.membershipNote,
          state: decision.state,
          hasMemberAccess: decision.hasMemberAccess,
        }
      : null,
  };
}

const userViewSelection = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  membershipStatus: memberships.status,
  membershipStartsAt: memberships.startsAt,
  membershipExpiresAt: memberships.expiresAt,
  membershipNote: memberships.note,
};

export async function listAdminUsers(
  db: AppDatabase,
  input: {
    page: number;
    pageSize: number;
    query?: string;
    role?: "member" | "admin";
    status?: "active" | "disabled";
  },
): Promise<{ items: AdminUserView[]; total: number }> {
  const conditions: SQL[] = [];

  if (input.query) {
    const normalizedQuery = normalizeUsername(input.query);
    conditions.push(
      or(
        like(users.usernameNormalized, `%${normalizedQuery}%`),
        like(users.displayName, `%${input.query}%`),
      )!,
    );
  }

  if (input.role) {
    conditions.push(eq(users.role, input.role));
  }

  if (input.status) {
    conditions.push(eq(users.status, input.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(where);
  const rows = await db
    .select(userViewSelection)
    .from(users)
    .leftJoin(memberships, eq(users.id, memberships.userId))
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.usernameNormalized))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return {
    items: rows.map((row) => toAdminUserView(row)),
    total,
  };
}

export async function getAdminUserById(
  db: AppDatabase,
  userId: string,
): Promise<AdminUserView | null> {
  const [row] = await db
    .select(userViewSelection)
    .from(users)
    .leftJoin(memberships, eq(users.id, memberships.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return row ? toAdminUserView(row) : null;
}

export async function createAdminUser(
  db: AppDatabase,
  actorUserId: string,
  input: CreateAdminUserInput,
): Promise<AdminUserView> {
  const username = input.username.trim().normalize("NFKC");
  const usernameNormalized = normalizeUsername(input.username);
  const existing = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.usernameNormalized, usernameNormalized),
  });

  if (existing) {
    throw new AdminUserServiceError(
      "USERNAME_CONFLICT",
      "用户名已被使用",
      409,
    );
  }

  const now = new Date();
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    username,
    usernameNormalized,
    displayName: input.displayName ?? null,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    status: input.status,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
  });

  if (input.membership) {
    await db.insert(memberships).values({
      id: generateId(),
      userId,
      status: input.membership.status,
      startsAt: input.membership.startsAt,
      expiresAt: input.membership.expiresAt,
      note: input.membership.note ?? null,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  }

  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.user_created",
    resourceType: "user",
    resourceId: userId,
    metadata: {
      role: input.role,
      status: input.status,
      membershipCreated: Boolean(input.membership),
    },
  });

  const created = await getAdminUserById(db, userId);

  if (!created) {
    throw new AdminUserServiceError(
      "USER_CREATE_FAILED",
      "用户创建后无法读取",
      500,
    );
  }

  return created;
}

async function ensureAdminCanBeDeactivated(
  db: AppDatabase,
  target: { role: "member" | "admin"; status: "active" | "disabled" },
  next: { role: "member" | "admin"; status: "active" | "disabled" },
): Promise<void> {
  const removesActiveAdmin =
    target.role === "admin" &&
    target.status === "active" &&
    (next.role !== "admin" || next.status !== "active");

  if (!removesActiveAdmin) {
    return;
  }

  const [{ activeAdminCount }] = await db
    .select({ activeAdminCount: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));

  if (activeAdminCount <= 1) {
    throw new AdminUserServiceError(
      "LAST_ACTIVE_ADMIN",
      "不能禁用或降级最后一个有效管理员",
      409,
    );
  }
}

export async function updateAdminUser(
  db: AppDatabase,
  actorUserId: string,
  targetUserId: string,
  input: UpdateAdminUserInput,
): Promise<AdminUserView> {
  const target = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
  });

  if (!target) {
    throw new AdminUserServiceError("USER_NOT_FOUND", "用户不存在", 404);
  }

  const nextRole = input.role ?? target.role;
  const nextStatus = input.status ?? target.status;
  await ensureAdminCanBeDeactivated(db, target, {
    role: nextRole,
    status: nextStatus,
  });

  const now = new Date();
  const userChanges: Partial<typeof users.$inferInsert> = {
    updatedAt: now,
  };

  if (input.displayName !== undefined) {
    userChanges.displayName = input.displayName;
  }
  if (input.role !== undefined) {
    userChanges.role = input.role;
  }
  if (input.status !== undefined) {
    userChanges.status = input.status;
  }

  await db.update(users).set(userChanges).where(eq(users.id, targetUserId));

  if (input.membership === null) {
    await db.delete(memberships).where(eq(memberships.userId, targetUserId));
  } else if (input.membership) {
    await db
      .insert(memberships)
      .values({
        id: generateId(),
        userId: targetUserId,
        status: input.membership.status,
        startsAt: input.membership.startsAt,
        expiresAt: input.membership.expiresAt,
        note: input.membership.note ?? null,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: memberships.userId,
        set: {
          status: input.membership.status,
          startsAt: input.membership.startsAt,
          expiresAt: input.membership.expiresAt,
          note: input.membership.note ?? null,
          source: "manual",
          updatedAt: now,
        },
      });
  }

  if (target.status === "active" && nextStatus === "disabled") {
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, targetUserId), eq(sessions.revokedAt, null)));
  }

  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.user_updated",
    resourceType: "user",
    resourceId: targetUserId,
    metadata: {
      changedFields: Object.keys(input),
      previousRole: target.role,
      nextRole,
      previousStatus: target.status,
      nextStatus,
    },
  });

  const updated = await getAdminUserById(db, targetUserId);

  if (!updated) {
    throw new AdminUserServiceError(
      "USER_UPDATE_FAILED",
      "用户更新后无法读取",
      500,
    );
  }

  return updated;
}

export async function resetAdminUserPassword(
  db: AppDatabase,
  actorUserId: string,
  targetUserId: string,
  password: string,
): Promise<void> {
  const target = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.id, targetUserId),
  });

  if (!target) {
    throw new AdminUserServiceError("USER_NOT_FOUND", "用户不存在", 404);
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      passwordChangedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, targetUserId));
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, targetUserId), eq(sessions.revokedAt, null)));
  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.user_password_reset",
    resourceType: "user",
    resourceId: targetUserId,
  });
}

export async function revokeAdminUserSessions(
  db: AppDatabase,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  const target = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.id, targetUserId),
  });

  if (!target) {
    throw new AdminUserServiceError("USER_NOT_FOUND", "用户不存在", 404);
  }

  const now = new Date();
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, targetUserId), eq(sessions.revokedAt, null)));
  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.user_sessions_revoked",
    resourceType: "user",
    resourceId: targetUserId,
  });
}
