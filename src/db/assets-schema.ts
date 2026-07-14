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

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id"),
    originalFilename: text("original_filename").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    altText: text("alt_text"),
    source: text("source", { enum: ["admin", "api"] }).notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedByApiClientId: text("uploaded_by_api_client_id").references(
      () => apiClients.id,
      { onDelete: "set null" },
    ),
    status: text("status", { enum: ["active", "deleted"] })
      .notNull()
      .default("active"),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    deletedAt: timestampMs("deleted_at"),
  },
  (table) => [
    uniqueIndex("assets_storage_key_unique").on(table.storageKey),
    uniqueIndex("assets_api_client_external_id_unique").on(
      table.uploadedByApiClientId,
      table.externalId,
    ),
    index("assets_status_created_at_idx").on(table.status, table.createdAt),
    index("assets_sha256_idx").on(table.sha256),
    index("assets_uploaded_by_user_id_idx").on(table.uploadedByUserId),
    index("assets_uploaded_by_api_client_id_idx").on(
      table.uploadedByApiClientId,
    ),
    check("assets_source_check", sql`${table.source} in ('admin', 'api')`),
    check("assets_status_check", sql`${table.status} in ('active', 'deleted')`),
    check("assets_size_bytes_check", sql`${table.sizeBytes} > 0`),
    check("assets_width_check", sql`${table.width} > 0`),
    check("assets_height_check", sql`${table.height} > 0`),
  ],
);

export const assetsRelations = relations(assets, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [assets.uploadedByUserId],
    references: [users.id],
  }),
  uploadedByApiClient: one(apiClients, {
    fields: [assets.uploadedByApiClientId],
    references: [apiClients.id],
  }),
}));

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
