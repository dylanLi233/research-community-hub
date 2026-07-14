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

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    descriptionHtml: text("description_html").notNull(),
    coverAssetId: text("cover_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    instructorName: text("instructor_name"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    accessLevel: text("access_level", {
      enum: ["public", "member", "private"],
    })
      .notNull()
      .default("member"),
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
    uniqueIndex("courses_slug_unique").on(table.slug),
    uniqueIndex("courses_import_external_unique").on(
      table.importedByApiClientId,
      table.externalId,
    ),
    index("courses_status_published_at_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("courses_access_status_idx").on(table.accessLevel, table.status),
    index("courses_cover_asset_id_idx").on(table.coverAssetId),
    index("courses_content_hash_idx").on(table.contentHash),
    index("courses_created_by_user_id_idx").on(table.createdByUserId),
    index("courses_deleted_at_idx").on(table.deletedAt),
    check(
      "courses_access_level_check",
      sql`${table.accessLevel} in ('public', 'member', 'private')`,
    ),
    check(
      "courses_status_check",
      sql`${table.status} in ('draft', 'pending_review', 'published', 'rejected', 'archived')`,
    ),
    check(
      "courses_title_length_check",
      sql`length(${table.title}) between 1 and 200`,
    ),
    check(
      "courses_summary_length_check",
      sql`length(${table.summary}) between 1 and 2000`,
    ),
    check(
      "courses_content_hash_length_check",
      sql`length(${table.contentHash}) = 64`,
    ),
  ],
);

export const courseChapters = sqliteTable(
  "course_chapters",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    bodyHtml: text("body_html").notNull(),
    accessLevel: text("access_level", {
      enum: ["public", "member", "private"],
    }).notNull(),
    previewMode: text("preview_mode", {
      enum: ["none", "paywall_marker", "summary_only"],
    }).notNull(),
    position: integer("position").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
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
    uniqueIndex("course_chapters_course_slug_unique").on(
      table.courseId,
      table.slug,
    ),
    uniqueIndex("course_chapters_course_external_unique").on(
      table.courseId,
      table.externalId,
    ),
    index("course_chapters_course_position_idx").on(
      table.courseId,
      table.position,
      table.createdAt,
    ),
    index("course_chapters_course_status_idx").on(
      table.courseId,
      table.status,
    ),
    index("course_chapters_access_status_idx").on(
      table.accessLevel,
      table.status,
    ),
    index("course_chapters_content_hash_idx").on(table.contentHash),
    index("course_chapters_created_by_user_id_idx").on(
      table.createdByUserId,
    ),
    index("course_chapters_deleted_at_idx").on(table.deletedAt),
    check(
      "course_chapters_access_level_check",
      sql`${table.accessLevel} in ('public', 'member', 'private')`,
    ),
    check(
      "course_chapters_preview_mode_check",
      sql`${table.previewMode} in ('none', 'paywall_marker', 'summary_only')`,
    ),
    check(
      "course_chapters_status_check",
      sql`${table.status} in ('draft', 'pending_review', 'published', 'rejected', 'archived')`,
    ),
    check(
      "course_chapters_access_preview_check",
      sql`(
        (${table.accessLevel} in ('public', 'private') and ${table.previewMode} = 'none')
        or
        (${table.accessLevel} = 'member' and ${table.previewMode} in ('paywall_marker', 'summary_only'))
      )`,
    ),
    check(
      "course_chapters_position_check",
      sql`${table.position} between 1 and 9999`,
    ),
    check(
      "course_chapters_estimated_minutes_check",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} between 1 and 600`,
    ),
    check(
      "course_chapters_content_hash_length_check",
      sql`length(${table.contentHash}) = 64`,
    ),
  ],
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  coverAsset: one(assets, {
    fields: [courses.coverAssetId],
    references: [assets.id],
  }),
  createdByUser: one(users, {
    fields: [courses.createdByUserId],
    references: [users.id],
  }),
  importedByApiClient: one(apiClients, {
    fields: [courses.importedByApiClientId],
    references: [apiClients.id],
  }),
  chapters: many(courseChapters),
}));

export const courseChaptersRelations = relations(
  courseChapters,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseChapters.courseId],
      references: [courses.id],
    }),
    createdByUser: one(users, {
      fields: [courseChapters.createdByUserId],
      references: [users.id],
    }),
    importedByApiClient: one(apiClients, {
      fields: [courseChapters.importedByApiClientId],
      references: [apiClients.id],
    }),
  }),
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseChapter = typeof courseChapters.$inferSelect;
export type NewCourseChapter = typeof courseChapters.$inferInsert;
