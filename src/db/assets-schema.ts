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
    mimeType: text("mime_type", {
      enum: ["image/jpeg", "image/png", "image/webp"],
    }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    altText: text("alt_text"),
    accessLevel: text("access_level", {
      enum: ["public", "member", "private"],
    })
      .notNull()
      .default("private"),
    status: text("status", { enum: ["active", "deleted"] })
      .notNull()
      .default("active"),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedByApiClientId: text("uploaded_by_api_client_id").references(
      () => apiClients.id,
      { onDelete: "set null" },
    ),
    createdAt: timestampMs("created_at").notNull().default(nowMs),
    updatedAt: timestampMs("updated_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("assets_storage_key_unique").on(table.storageKey),
    uniqueIndex("assets_api_client_external_id_unique").on(
      table.uploadedByApiClientId,
      table.externalId,
    ),
    index("assets_created_at_idx").on(table.createdAt),
    index("assets_external_id_idx").on(table.externalId),
    index("assets_sha256_idx").on(table.sha256),
    index("assets_access_status_idx").on(table.accessLevel, table.status),
    index("assets_uploaded_by_user_id_idx").on(table.uploadedByUserId),
    index("assets_uploaded_by_api_client_id_idx").on(
      table.uploadedByApiClientId,
    ),
    check(
      "assets_mime_type_check",
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "assets_access_level_check",
      sql`${table.accessLevel} in ('public', 'member', 'private')`,
    ),
    check(
      "assets_status_check",
      sql`${table.status} in ('active', 'deleted')`,
    ),
    check(
      "assets_size_bytes_check",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 10485760`,
    ),
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
