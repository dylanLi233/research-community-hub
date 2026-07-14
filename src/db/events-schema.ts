import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { apiClients, users } from "./schema";

const nowMs = sql`(unixepoch() * 1000)`;
const timestampMs = (name: string) => integer(name, { mode: "timestamp_ms" });

export const marketEvents = sqliteTable(
  "market_events",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    eventDate: text("event_date").notNull(),
    startsAt: timestampMs("starts_at"),
    endsAt: timestampMs("ends_at"),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    category: text("category", {
      enum: [
        "macro",
        "policy",
        "central_bank",
        "economic_data",
        "industry",
        "company",
        "earnings",
        "market",
        "geopolitics",
        "other",
      ],
    }).notNull(),
    importance: text("importance", { enum: ["high", "medium", "low"] })
      .notNull()
      .default("medium"),
    region: text("region"),
    summary: text("summary").notNull(),
    impact: text("impact"),
    focusPoints: text("focus_points", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    accessLevel: text("access_level", {
      enum: ["public", "member", "private"],
    })
      .notNull()
      .default("public"),
    status: text("status", {
      enum: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "archived",
      ],
    })
      .notNull()
      .default("draft"),
    rejectionReason: text("rejection_reason"),
    publishedAt: timestampMs("published_at"),
    contentHash: text("content_hash").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    importedByApiClientId: text("imported_by_api_client_id").references(
      () => apiClients.id,
      { onDelete: "set null" },
    ),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
    deletedAt: timestampMs("deleted_at"),
  },
  (table) => [
    uniqueIndex("market_events_import_external_unique").on(
      table.importedByApiClientId,
      table.externalId,
    ),
    index("market_events_date_status_idx").on(table.eventDate, table.status),
    index("market_events_starts_at_idx").on(table.startsAt),
    index("market_events_category_date_idx").on(table.category, table.eventDate),
    index("market_events_importance_date_idx").on(
      table.importance,
      table.eventDate,
    ),
    index("market_events_access_status_idx").on(
      table.accessLevel,
      table.status,
    ),
    index("market_events_content_hash_idx").on(table.contentHash),
    index("market_events_created_by_user_id_idx").on(table.createdByUserId),
    index("market_events_deleted_at_idx").on(table.deletedAt),
    check(
      "market_events_category_check",
      sql`${table.category} in ('macro', 'policy', 'central_bank', 'economic_data', 'industry', 'company', 'earnings', 'market', 'geopolitics', 'other')`,
    ),
    check(
      "market_events_importance_check",
      sql`${table.importance} in ('high', 'medium', 'low')`,
    ),
    check(
      "market_events_access_level_check",
      sql`${table.accessLevel} in ('public', 'member', 'private')`,
    ),
    check(
      "market_events_status_check",
      sql`${table.status} in ('draft', 'pending_review', 'published', 'rejected', 'archived')`,
    ),
    check(
      "market_events_all_day_time_check",
      sql`(${table.allDay} = 0) or (${table.startsAt} is null and ${table.endsAt} is null)`,
    ),
    check(
      "market_events_time_range_check",
      sql`${table.endsAt} is null or (${table.startsAt} is not null and ${table.endsAt} > ${table.startsAt})`,
    ),
    check(
      "market_events_content_hash_length_check",
      sql`length(${table.contentHash}) = 64`,
    ),
  ],
);

export const marketEventsRelations = relations(marketEvents, ({ one }) => ({
  createdByUser: one(users, {
    fields: [marketEvents.createdByUserId],
    references: [users.id],
  }),
  importedByApiClient: one(apiClients, {
    fields: [marketEvents.importedByApiClientId],
    references: [apiClients.id],
  }),
}));

export type MarketEvent = typeof marketEvents.$inferSelect;
export type NewMarketEvent = typeof marketEvents.$inferInsert;
