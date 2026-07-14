import type { AppDatabase } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { generateId } from "@/auth/token";

type AuditEntry = {
  actorType: "user" | "api" | "system";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: unknown;
};

export async function writeAuditLog(
  db: AppDatabase,
  entry: AuditEntry,
): Promise<void> {
  await db.insert(auditLogs).values({
    id: generateId(),
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata,
  });
}
