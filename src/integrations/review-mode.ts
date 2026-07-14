import { eq } from "drizzle-orm";

import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { appSettings, auditLogs } from "@/db/schema";

export const REVIEW_MODE_SETTING_KEY = "review_mode";
export type ReviewMode = "on" | "off";

export function normalizeReviewMode(value: unknown): ReviewMode {
  return value === "off" ? "off" : "on";
}

export async function getReviewMode(db: AppDatabase): Promise<ReviewMode> {
  const setting = await db.query.appSettings.findFirst({
    columns: { value: true },
    where: eq(appSettings.key, REVIEW_MODE_SETTING_KEY),
  });

  return normalizeReviewMode(setting?.value);
}

export async function setReviewMode(
  db: AppDatabase,
  actorUserId: string,
  mode: ReviewMode,
): Promise<ReviewMode> {
  const previousMode = await getReviewMode(db);
  const now = new Date();

  await db.batch([
    db
      .insert(appSettings)
      .values({
        key: REVIEW_MODE_SETTING_KEY,
        value: mode,
        updatedByUserId: actorUserId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: mode,
          updatedByUserId: actorUserId,
          updatedAt: now,
        },
      }),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.review_mode_updated",
      resourceType: "app_setting",
      resourceId: REVIEW_MODE_SETTING_KEY,
      metadata: { previousMode, mode },
      createdAt: now,
    }),
  ]);

  return mode;
}
