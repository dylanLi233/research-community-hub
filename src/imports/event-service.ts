import { and, eq } from "drizzle-orm";

import type { ImportEventInput } from "./event-validation";
import type { ImportResponseBody } from "./log-service";
import { hashEventContent } from "@/events/hash";
import {
  decideEventImportAction,
  decideEventImportOutcome,
} from "@/events/state";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { marketEvents } from "@/db/events-schema";
import { importResponseSnapshots } from "@/db/import-schema";
import { auditLogs, importRequests } from "@/db/schema";
import { getReviewMode } from "@/integrations/review-mode";

export class ImportEventServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Array<{
      field?: string;
      code: string;
      message: string;
    }>,
  ) {
    super(message);
    this.name = "ImportEventServiceError";
  }
}

function responseBody(input: {
  requestId: string;
  clientRequestId: string | null;
  action: "created" | "updated" | "unchanged";
  eventId: string;
  externalId: string;
  status: string;
  eventDate: string;
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    data: {
      action: input.action,
      event_id: input.eventId,
      external_id: input.externalId,
      status: input.status,
      event_date: input.eventDate,
      url: `/events#event-${input.eventId}`,
      warnings: [],
    },
  };
}

export async function importMarketEvent(
  db: AppDatabase,
  input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    requestId: string;
    clientRequestId: string | null;
    payload: ImportEventInput;
    startedAt: number;
  },
): Promise<{ httpStatus: number; body: ImportResponseBody }> {
  const [existing] = await db
    .select()
    .from(marketEvents)
    .where(
      and(
        eq(marketEvents.importedByApiClientId, input.apiClientId),
        eq(marketEvents.externalId, input.payload.externalId),
      ),
    )
    .limit(1);

  if (existing?.deletedAt) {
    throw new ImportEventServiceError(
      "EVENT_EXTERNAL_ID_DELETED",
      "该 external_id 对应的事件已删除，不能自动恢复",
      409,
    );
  }

  const contentHash = await hashEventContent(input.payload.event);
  const action = decideEventImportAction(
    existing?.contentHash ?? null,
    contentHash,
  );
  const reviewMode = await getReviewMode(db);
  const outcome = decideEventImportOutcome({
    action,
    currentStatus: existing?.status ?? null,
    reviewMode,
  });
  const eventId = existing?.id ?? generateId();
  const now = new Date();
  const durationMs = Date.now() - input.startedAt;
  const body = responseBody({
    requestId: input.requestId,
    clientRequestId: input.clientRequestId,
    action,
    eventId,
    externalId: input.payload.externalId,
    status: outcome.status,
    eventDate: input.payload.event.eventDate,
  });

  if (action === "created") {
    await db.batch([
      db.insert(marketEvents).values({
        id: eventId,
        externalId: input.payload.externalId,
        ...input.payload.event,
        status: outcome.status,
        publishedAt: outcome.status === "published" ? now : null,
        contentHash,
        importedByApiClientId: input.apiClientId,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/events",
        externalId: input.payload.externalId,
        contentType: "market_event",
        result: "success",
        httpStatus: outcome.httpStatus,
        resourceType: "market_event",
        resourceId: eventId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData: body,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.event_created",
        resourceType: "market_event",
        resourceId: eventId,
        metadata: {
          externalId: input.payload.externalId,
          eventDate: input.payload.event.eventDate,
          contentHash,
          status: outcome.status,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  } else if (action === "updated") {
    await db.batch([
      db
        .update(marketEvents)
        .set({
          ...input.payload.event,
          status: outcome.status,
          publishedAt:
            outcome.status === "published" ? now : existing!.publishedAt,
          rejectionReason: null,
          contentHash,
          updatedAt: now,
        })
        .where(eq(marketEvents.id, eventId)),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/events",
        externalId: input.payload.externalId,
        contentType: "market_event",
        result: "success",
        httpStatus: outcome.httpStatus,
        resourceType: "market_event",
        resourceId: eventId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData: body,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.event_updated",
        resourceType: "market_event",
        resourceId: eventId,
        metadata: {
          externalId: input.payload.externalId,
          previousContentHash: existing!.contentHash,
          contentHash,
          status: outcome.status,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  } else {
    await db.batch([
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/events",
        externalId: input.payload.externalId,
        contentType: "market_event",
        result: "success",
        httpStatus: 200,
        resourceType: "market_event",
        resourceId: eventId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData: body,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.event_unchanged",
        resourceType: "market_event",
        resourceId: eventId,
        metadata: {
          externalId: input.payload.externalId,
          contentHash,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  }

  return { httpStatus: outcome.httpStatus, body };
}

export async function getImportedEventSummary(
  db: AppDatabase,
  apiClientId: string,
  externalId: string,
): Promise<Record<string, unknown> | null> {
  const [event] = await db
    .select({
      id: marketEvents.id,
      externalId: marketEvents.externalId,
      title: marketEvents.title,
      eventDate: marketEvents.eventDate,
      startsAt: marketEvents.startsAt,
      endsAt: marketEvents.endsAt,
      timezone: marketEvents.timezone,
      category: marketEvents.category,
      importance: marketEvents.importance,
      accessLevel: marketEvents.accessLevel,
      status: marketEvents.status,
      publishedAt: marketEvents.publishedAt,
      updatedAt: marketEvents.updatedAt,
      deletedAt: marketEvents.deletedAt,
    })
    .from(marketEvents)
    .where(
      and(
        eq(marketEvents.importedByApiClientId, apiClientId),
        eq(marketEvents.externalId, externalId),
      ),
    )
    .limit(1);

  if (!event || event.deletedAt) {
    return null;
  }

  return {
    event_id: event.id,
    external_id: event.externalId,
    title: event.title,
    event_date: event.eventDate,
    starts_at: event.startsAt?.toISOString() ?? null,
    ends_at: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    category: event.category,
    importance: event.importance,
    access_level: event.accessLevel,
    status: event.status,
    published_at: event.publishedAt?.toISOString() ?? null,
    updated_at: event.updatedAt.toISOString(),
    url: `/events#event-${event.id}`,
  };
}
