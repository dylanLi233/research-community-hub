import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { assets } from "./assets-schema";
import { apiClients, users } from "./schema";

const nowMs = sql`(unixepoch() * 1000)`;
const timestampMs = (name: string) => integer(name, { mode: "timestamp_ms" });

export const researchReports = sqliteTable(
  "research_reports",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    bodyHtml: text("body_html").notNull(),
    accessLevel: text("access_level", {
      enum: ["public", "member", "private"],
    }).notNull(),
    previewMode: text("preview_mode", {
      enum: ["none", "paywall_marker", "summary_only"],
    }).notNull(),
    sourceInstitution: text("source_institution").notNull(),
    sourceReportDate: text("source_report_date"),
    authorName: text("author_name"),
    coverAssetId: text("cover_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
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
    scheduledAt: timestampMs("scheduled_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
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
    uniqueIndex("research_reports_slug_unique").on(table.slug),
    uniqueIndex("research_reports_import_external_unique").on(
      table.importedByApiClientId,
      table.externalId,
    ),
    index("research_reports_status_published_at_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("research_reports_access_status_idx").on(
      table.accessLevel,
      table.status,
    ),
    index("research_reports_source_report_date_idx").on(
      table.sourceReportDate,
    ),
    index("research_reports_content_hash_idx").on(table.contentHash),
    index("research_reports_cover_asset_id_idx").on(table.coverAssetId),
    index("research_reports_created_by_user_id_idx").on(
      table.createdByUserId,
    ),
    index("research_reports_deleted_at_idx").on(table.deletedAt),
    check(
      "research_reports_access_level_check",
      sql`${table.accessLevel} in ('public', 'member', 'private')`,
    ),
    check(
      "research_reports_preview_mode_check",
      sql`${table.previewMode} in ('none', 'paywall_marker', 'summary_only')`,
    ),
    check(
      "research_reports_status_check",
      sql`${table.status} in ('draft', 'pending_review', 'published', 'rejected', 'archived')`,
    ),
    check(
      "research_reports_access_preview_check",
      sql`(
        (${table.accessLevel} in ('public', 'private') and ${table.previewMode} = 'none')
        or
        (${table.accessLevel} = 'member' and ${table.previewMode} in ('paywall_marker', 'summary_only'))
      )`,
    ),
    check(
      "research_reports_title_length_check",
      sql`length(${table.title}) between 1 and 200`,
    ),
    check(
      "research_reports_summary_length_check",
      sql`length(${table.summary}) between 1 and 2000`,
    ),
    check(
      "research_reports_content_hash_length_check",
      sql`length(${table.contentHash}) = 64`,
    ),
  ],
);

export const researchReportsRelations = relations(
  researchReports,
  ({ one }) => ({
    coverAsset: one(assets, {
      fields: [researchReports.coverAssetId],
      references: [assets.id],
    }),
    createdByUser: one(users, {
      fields: [researchReports.createdByUserId],
      references: [users.id],
    }),
    importedByApiClient: one(apiClients, {
      fields: [researchReports.importedByApiClientId],
      references: [apiClients.id],
    }),
  }),
);

export type ResearchReport = typeof researchReports.$inferSelect;
export type NewResearchReport = typeof researchReports.$inferInsert;
