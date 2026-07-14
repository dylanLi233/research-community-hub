import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count } from "drizzle-orm";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/audit/write";
import { hashPassword } from "@/auth/password";
import { constantTimeEqualText, generateId } from "@/auth/token";
import {
  bootstrapAdminSchema,
  normalizeUsername,
} from "@/auth/validation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const expectedSecret = env.BOOTSTRAP_ADMIN_SECRET;

    if (!expectedSecret) {
      return apiError("NOT_FOUND", "接口不存在", 404);
    }

    const authorization = request.headers.get("Authorization");
    const providedSecret = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";

    if (
      !providedSecret ||
      !(await constantTimeEqualText(providedSecret, expectedSecret))
    ) {
      return apiError("INVALID_BOOTSTRAP_SECRET", "Bootstrap 凭证无效", 401);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "请求体必须是有效的 JSON", 400);
    }

    const parsed = bootstrapAdminSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "管理员信息格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const db = await getDb();
    const [{ userCount }] = await db
      .select({ userCount: count() })
      .from(users);

    if (userCount > 0) {
      return apiError(
        "BOOTSTRAP_ALREADY_COMPLETED",
        "系统已存在用户，Bootstrap 已关闭",
        409,
      );
    }

    const now = new Date();
    const userId = generateId();

    await db.insert(users).values({
      id: userId,
      username: parsed.data.username.trim().normalize("NFKC"),
      usernameNormalized: normalizeUsername(parsed.data.username),
      displayName: parsed.data.displayName ?? null,
      passwordHash: await hashPassword(parsed.data.password),
      role: "admin",
      status: "active",
      mustChangePassword: false,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(db, {
      actorType: "system",
      action: "auth.bootstrap_admin_created",
      resourceType: "user",
      resourceId: userId,
    });

    return NextResponse.json(
      {
        data: {
          id: userId,
          username: parsed.data.username.trim().normalize("NFKC"),
          role: "admin",
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Admin bootstrap failed unexpectedly", error);
    return apiError("INTERNAL_ERROR", "管理员初始化暂时不可用", 500);
  }
}
