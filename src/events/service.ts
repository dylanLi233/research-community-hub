import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import { hashEventContent, type EventHashInput } from "./hash";
import { canArchiveEvent, canPublishEvent } from "./state";
import {
  createAdminEventSchema,
  type CreateAdminEventInput,
  type EventListQueryInput,
  type UpdateAdminEventInput,
} from "./validation";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { marketEvents } from "@/db/events-schema";
import { auditLogs } from "@/db/schema";
import type { ApiErrorDetail } from "@/lib/api-response";

export class EventServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "EventServiceError";
  }
}

export type AdminEventView = {
  id: string;
  externalId: string | null;
  title: string;
  eventDate: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  allDay: boolean;
  category: EventHashInput["category"];
  importance: EventHashInput["importance"];
  region: string | null;
  summary: string;
  impact: string | null;
  focusPoints: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  tags: string[];
  accessLevel: EventHashInput["accessLevel"];
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toEventView(row: typeof marketEvents.$inferSelect): AdminEventView {
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    eventDate: row.eventDate,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    timezone: row.timezone,
    allDay: row.allDay,
    category: row.category,
    importance: row.importance,
    region: row.region,
    summary: row.summary,
    impact: row.impact,
    focusPoints: row.focusPoints,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    tags: row.tags,
    accessLevel: row.accessLevel,
    status: row.status,
    rejectionReason: row.rejectionReason,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toHashInput(input: CreateAdminEventInput): EventHashInput {
  return {
    title: input.title,
    eventDate: input.eventDate,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    timezone: input.timezone,
    allDay: input.allDay,
    category: input.category,
    importance: input.importance,
    region: input.region ?? null,
    summary: input.summary,
    impact: input.impact ?? null,
    focusPoints: input.focusPoints,
    sourceName: input.sourceName ?? null,
    sourceUrl: input.sourceUrl ?? null,
    tags: input.tags,
    accessLevel: input.accessLevel,
  };
}

function currentToCreateInput(
  row: typeof marketEvents.$inferSelect,
): CreateAdminEventInput {
  return {
    title: row.title,
    eventDate: row.eventDate,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    allDay: row.allDay,
    category: row.category,
    importance: row.importance,
    region: row.region,
    summary: row.summary,
    impact: row.impact,
    focusPoints: row.focusPoints,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    tags: row.tags,
    accessLevel: row.accessLevel,
  };
}

function mergeEventInput(
  current: typeof marketEvents.$inferSelect,
  update: UpdateAdminEventInput,
): CreateAdminEventInput {
  const base = currentToCreateInput(current);
  const merged = {
    ...base,
    ...update,
    startsAt: update.startsAt === undefined ? base.startsAt : update.startsAt,
    endsAt: update.endsAt === undefined ? base.endsAt : update.endsAt,
    region: update.region === undefined ? base.region : update.region,
    impact: update.impact === undefined ? base.impact : update.impact,
    sourceName:
      update.sourceName === undefined ? base.sourceName : update.sourceName,
    sourceUrl: update.sourceUrl === undefined ? base.sourceUrl : update.sourceUrl,
  };
  const parsed = createAdminEventSchema.safeParse(merged);

  if (!parsed.success) {
    throw new EventServiceError(
      "VALIDATION_FAILED",
      "事件信息格式不正确",
      400,
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

async function getEventRow(
  db: AppDatabase,
  eventId: string,
): Promise<typeof marketEvents.$inferSelect> {
  const [event] = await db
    .select()
    .from(marketEvents)
    .where(and(eq(marketEvents.id, eventId), isNull(marketEvents.deletedAt)))
    .limit(1);

  if (!event) {
    throw new EventServiceError("EVENT_NOT_FOUND", "事件不存在", 404);
  }

  return event;
}

export async function listAdminEvents(
  db: AppDatabase,
  input: EventListQueryInput,
): Promise<{ items: AdminEventView[]; total: number }> {
  const conditions: SQL[] = [isNull(marketEvents.deletedAt)];

  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(
      or(
        like(marketEvents.title, pattern),
        like(marketEvents.summary, pattern),
        like(marketEvents.impact, pattern),
      )!,
    );
  }

  if (input.dateFrom) {
    conditions.push(gte(marketEvents.eventDate, input.dateFrom));
  }

  if (input.dateTo) {
    conditions.push(lte(marketEvents.eventDate, input.dateTo));
  }

  if (input.category) {
    conditions.push(eq(marketEvents.category, input.category));
  }

  if (input.importance) {
    conditions.push(eq(marketEvents.importance, input.importance));
  }

  if (input.status) {
    conditions.push(eq(marketEvents.status, input.status));
  }

  if (input.accessLevel) {
    conditions.push(eq(marketEvents.accessLevel, input.accessLevel));
  }

  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(marketEvents)
    .where(where);
  const rows = await db
    .select()
    .from(marketEvents)
    .where(where)
    .orderBy(desc(marketEvents.eventDate), desc(marketEvents.startsAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return { items: rows.map(toEventView), total };
}

export async function getAdminEvent(
  db: AppDatabase,
  eventId: string,
): Promise<AdminEventView> {
  return toEventView(await getEventRow(db, eventId));
}

export async function createAdminEvent(
  db: AppDatabase,
  actorUserId: string,
  input: CreateAdminEventInput,
): Promise<AdminEventView> {
  const now = new Date();
  const eventId = generateId();
  const hashInput = toHashInput(input);
  const contentHash = await hashEventContent(hashInput);

  await db.batch([
    db.insert(marketEvents).values({
      id: eventId,
      ...hashInput,
      focusPoints: hashInput.focusPoints,
      tags: hashInput.tags,
      status: "draft",
      contentHash,
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.event_created",
      resourceType: "market_event",
      resourceId: eventId,
      metadata: { eventDate: input.eventDate, category: input.category, contentHash },
      createdAt: now,
    }),
  ]);

  return getAdminEvent(db, eventId);
}

export async function updateAdminEvent(
  db: AppDatabase,
  actorUserId: string,
  eventId: string,
  input: UpdateAdminEventInput,
): Promise<AdminEventView> {
  const current = await getEventRow(db, eventId);
  const merged = mergeEventInput(current, input);
  const hashInput = toHashInput(merged);
  const contentHash = await hashEventContent(hashInput);
  const now = new Date();

  await db.batch([
    db
      .update(marketEvents)
      .set({ ...hashInput, contentHash, updatedAt: now })
      .where(eq(marketEvents.id, eventId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.event_updated",
      resourceType: "market_event",
      resourceId: eventId,
      metadata: {
        changedFields: Object.keys(input),
        previousContentHash: current.contentHash,
        contentHash,
      },
      createdAt: now,
    }),
  ]);

  return getAdminEvent(db, eventId);
}

export async function publishAdminEvent(
  db: AppDatabase,
  actorUserId: string,
  eventId: string,
): Promise<AdminEventView> {
  const current = await getEventRow(db, eventId);

  if (!canPublishEvent(current.status)) {
    throw new EventServiceError(
      "INVALID_EVENT_TRANSITION",
      "当前事件状态不能发布",
      409,
    );
  }

  const now = new Date();
  await db.batch([
    db
      .update(marketEvents)
      .set({
        status: "published",
        publishedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(marketEvents.id, eventId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.event_published",
      resourceType: "market_event",
      resourceId: eventId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);

  return getAdminEvent(db, eventId);
}

export async function archiveAdminEvent(
  db: AppDatabase,
  actorUserId: string,
  eventId: string,
): Promise<AdminEventView> {
  const current = await getEventRow(db, eventId);

  if (!canArchiveEvent(current.status)) {
    throw new EventServiceError(
      "INVALID_EVENT_TRANSITION",
      "只有已发布事件可以归档",
      409,
    );
  }

  const now = new Date();
  await db.batch([
    db
      .update(marketEvents)
      .set({ status: "archived", updatedAt: now })
      .where(eq(marketEvents.id, eventId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.event_archived",
      resourceType: "market_event",
      resourceId: eventId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);

  return getAdminEvent(db, eventId);
}
