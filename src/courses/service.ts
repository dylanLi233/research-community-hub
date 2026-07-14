import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  like,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import {
  hashChapterContent,
  hashCourseContent,
  type ChapterHashInput,
  type CourseHashInput,
} from "./hash";
import {
  collectCourseAssetIds,
  validateChapterAssetReferences,
  validateCourseAssetReferences,
} from "./media-policy";
import {
  canArchiveCourseContent,
  canPublishChapterWithinCourse,
  canPublishCourseContent,
} from "./state";
import {
  createAdminChapterSchema,
  type CourseListQueryInput,
  type CreateAdminChapterInput,
  type CreateAdminCourseInput,
  type UpdateAdminChapterInput,
  type UpdateAdminCourseInput,
} from "./validation";
import { generateId } from "@/auth/token";
import { prepareContentHtml } from "@/content/pipeline";
import { ContentHtmlError } from "@/content/types";
import { assets } from "@/db/assets-schema";
import type { AppDatabase } from "@/db/client";
import { courseChapters, courses } from "@/db/courses-schema";
import { auditLogs } from "@/db/schema";
import type { ApiErrorDetail } from "@/lib/api-response";
import { extractMediaAssetIds } from "@/reports/media-policy";

export class CourseServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "CourseServiceError";
  }
}

type CourseWarnings = ReturnType<typeof prepareContentHtml>["warnings"];

export type AdminCourseView = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  descriptionHtml: string;
  coverAssetId: string | null;
  coverUrl: string | null;
  instructorName: string | null;
  tags: string[];
  accessLevel: "public" | "member" | "private";
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  rejectionReason: string | null;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  chapterCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminChapterView = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  position: number;
  estimatedMinutes: number | null;
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toCourseView(
  row: typeof courses.$inferSelect,
  chapterCount?: number,
): AdminCourseView {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    summary: row.summary,
    descriptionHtml: row.descriptionHtml,
    coverAssetId: row.coverAssetId,
    coverUrl: row.coverAssetId ? `/media/${row.coverAssetId}` : null,
    instructorName: row.instructorName,
    tags: row.tags,
    accessLevel: row.accessLevel,
    status: row.status,
    rejectionReason: row.rejectionReason,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ...(chapterCount === undefined ? {} : { chapterCount }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toChapterView(
  row: typeof courseChapters.$inferSelect,
): AdminChapterView {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyHtml: row.bodyHtml,
    accessLevel: row.accessLevel,
    previewMode: row.previewMode,
    position: row.position,
    estimatedMinutes: row.estimatedMinutes,
    status: row.status,
    rejectionReason: row.rejectionReason,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function contentError(error: ContentHtmlError, field: string): CourseServiceError {
  return new CourseServiceError(error.code, error.message, 422, [
    { field, code: error.code, message: error.message },
  ]);
}

function assetError(
  issues: Array<{ field: string; code: string; message: string }>,
): CourseServiceError {
  return new CourseServiceError(
    "COURSE_ASSET_VALIDATION_FAILED",
    "课程引用的素材未通过校验",
    422,
    issues,
  );
}

async function loadAssetRecords(db: AppDatabase, ids: string[]) {
  return ids.length === 0
    ? []
    : db
        .select({
          id: assets.id,
          accessLevel: assets.accessLevel,
          status: assets.status,
        })
        .from(assets)
        .where(inArray(assets.id, ids));
}

function courseInputState(input: CreateAdminCourseInput): CourseHashInput {
  return {
    title: input.title,
    subtitle: input.subtitle ?? null,
    slug: input.slug,
    summary: input.summary,
    descriptionHtml: input.descriptionHtml,
    coverAssetId: input.coverAssetId ?? null,
    instructorName: input.instructorName ?? null,
    tags: input.tags,
    accessLevel: input.accessLevel,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };
}

function chapterInputState(input: CreateAdminChapterInput): ChapterHashInput {
  return {
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    bodyHtml: input.bodyHtml,
    accessLevel: input.accessLevel,
    previewMode: input.previewMode,
    position: input.position,
    estimatedMinutes: input.estimatedMinutes ?? null,
  };
}

async function prepareCourseState(
  db: AppDatabase,
  input: CourseHashInput,
): Promise<{ state: CourseHashInput; warnings: CourseWarnings }> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.descriptionHtml,
      accessLevel: "public",
      previewMode: "none",
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw contentError(error, "descriptionHtml");
    }
    throw error;
  }

  const state = { ...input, descriptionHtml: prepared.bodyHtml };
  const ids = collectCourseAssetIds({
    coverAssetId: state.coverAssetId,
    descriptionHtml: state.descriptionHtml,
  });
  const records = await loadAssetRecords(db, ids);
  const issues = validateCourseAssetReferences({
    coverAssetId: state.coverAssetId,
    descriptionHtml: state.descriptionHtml,
    assets: records,
  });

  if (issues.length > 0) {
    throw assetError(
      issues.map((issue) => ({
        field: issue.field === "bodyHtml" ? "descriptionHtml" : issue.field,
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return { state, warnings: prepared.warnings };
}

async function prepareChapterState(
  db: AppDatabase,
  input: ChapterHashInput,
): Promise<{ state: ChapterHashInput; warnings: CourseWarnings }> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.bodyHtml,
      accessLevel: input.accessLevel,
      previewMode: input.previewMode,
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw contentError(error, "bodyHtml");
    }
    throw error;
  }

  const state = { ...input, bodyHtml: prepared.bodyHtml };
  const records = await loadAssetRecords(
    db,
    extractMediaAssetIds(state.bodyHtml),
  );
  const issues = validateChapterAssetReferences({
    bodyHtml: state.bodyHtml,
    accessLevel: state.accessLevel,
    previewMode: state.previewMode,
    assets: records,
  });

  if (issues.length > 0) {
    throw assetError(
      issues.map((issue) => ({
        field: "bodyHtml",
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return { state, warnings: prepared.warnings };
}

async function ensureCourseSlugAvailable(
  db: AppDatabase,
  slug: string,
  excludingId?: string,
) {
  const conditions: SQL[] = [eq(courses.slug, slug)];
  if (excludingId) conditions.push(ne(courses.id, excludingId));
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new CourseServiceError("COURSE_SLUG_CONFLICT", "课程 Slug 已被使用", 409, [
      { field: "slug", code: "COURSE_SLUG_CONFLICT", message: "课程 Slug 必须全站唯一" },
    ]);
  }
}

async function ensureChapterSlugAvailable(
  db: AppDatabase,
  courseId: string,
  slug: string,
  excludingId?: string,
) {
  const conditions: SQL[] = [
    eq(courseChapters.courseId, courseId),
    eq(courseChapters.slug, slug),
  ];
  if (excludingId) conditions.push(ne(courseChapters.id, excludingId));
  const [existing] = await db
    .select({ id: courseChapters.id })
    .from(courseChapters)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new CourseServiceError("CHAPTER_SLUG_CONFLICT", "章节 Slug 已被使用", 409, [
      { field: "slug", code: "CHAPTER_SLUG_CONFLICT", message: "章节 Slug 在同一课程内必须唯一" },
    ]);
  }
}

async function getCourseRow(db: AppDatabase, courseId: string) {
  const [row] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1);
  if (!row) throw new CourseServiceError("COURSE_NOT_FOUND", "课程不存在", 404);
  return row;
}

async function getChapterRow(
  db: AppDatabase,
  courseId: string,
  chapterId: string,
) {
  const [row] = await db
    .select()
    .from(courseChapters)
    .where(
      and(
        eq(courseChapters.id, chapterId),
        eq(courseChapters.courseId, courseId),
        isNull(courseChapters.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new CourseServiceError("CHAPTER_NOT_FOUND", "章节不存在", 404);
  return row;
}

function mergeCourseInput(
  current: typeof courses.$inferSelect,
  update: UpdateAdminCourseInput,
): CourseHashInput {
  return {
    title: update.title ?? current.title,
    subtitle: update.subtitle === undefined ? current.subtitle : update.subtitle,
    slug: update.slug ?? current.slug,
    summary: update.summary ?? current.summary,
    descriptionHtml: update.descriptionHtml ?? current.descriptionHtml,
    coverAssetId:
      update.coverAssetId === undefined ? current.coverAssetId : update.coverAssetId,
    instructorName:
      update.instructorName === undefined
        ? current.instructorName
        : update.instructorName,
    tags: update.tags ?? current.tags,
    accessLevel: update.accessLevel ?? current.accessLevel,
    seoTitle: update.seoTitle === undefined ? current.seoTitle : update.seoTitle,
    seoDescription:
      update.seoDescription === undefined
        ? current.seoDescription
        : update.seoDescription,
  };
}

function mergeChapterInput(
  current: typeof courseChapters.$inferSelect,
  update: UpdateAdminChapterInput,
): ChapterHashInput {
  const candidate = {
    title: update.title ?? current.title,
    slug: update.slug ?? current.slug,
    summary: update.summary ?? current.summary,
    bodyHtml: update.bodyHtml ?? current.bodyHtml,
    accessLevel: update.accessLevel ?? current.accessLevel,
    previewMode: update.previewMode ?? current.previewMode,
    position: update.position ?? current.position,
    estimatedMinutes:
      update.estimatedMinutes === undefined
        ? current.estimatedMinutes
        : update.estimatedMinutes,
  };
  const parsed = createAdminChapterSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CourseServiceError(
      "VALIDATION_FAILED",
      "章节信息格式不正确",
      400,
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      })),
    );
  }
  return chapterInputState(parsed.data);
}

export async function listAdminCourses(
  db: AppDatabase,
  input: CourseListQueryInput,
): Promise<{ items: AdminCourseView[]; total: number }> {
  const conditions: SQL[] = [isNull(courses.deletedAt)];
  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(
      or(
        like(courses.title, pattern),
        like(courses.subtitle, pattern),
        like(courses.summary, pattern),
      )!,
    );
  }
  if (input.status) conditions.push(eq(courses.status, input.status));
  if (input.accessLevel) conditions.push(eq(courses.accessLevel, input.accessLevel));
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(courses).where(where);
  const rows = await db
    .select()
    .from(courses)
    .where(where)
    .orderBy(desc(courses.updatedAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);
  const counts = await Promise.all(
    rows.map(async (row) => {
      const [{ total: chapterCount }] = await db
        .select({ total: count() })
        .from(courseChapters)
        .where(
          and(
            eq(courseChapters.courseId, row.id),
            isNull(courseChapters.deletedAt),
          ),
        );
      return toCourseView(row, chapterCount);
    }),
  );
  return { items: counts, total };
}

export async function getAdminCourse(db: AppDatabase, courseId: string) {
  const row = await getCourseRow(db, courseId);
  const [{ total: chapterCount }] = await db
    .select({ total: count() })
    .from(courseChapters)
    .where(
      and(eq(courseChapters.courseId, courseId), isNull(courseChapters.deletedAt)),
    );
  return toCourseView(row, chapterCount);
}

export async function createAdminCourse(
  db: AppDatabase,
  actorUserId: string,
  input: CreateAdminCourseInput,
): Promise<{ course: AdminCourseView; warnings: CourseWarnings }> {
  await ensureCourseSlugAvailable(db, input.slug);
  const prepared = await prepareCourseState(db, courseInputState(input));
  const now = new Date();
  const courseId = generateId();
  const contentHash = await hashCourseContent(prepared.state);
  await db.batch([
    db.insert(courses).values({
      id: courseId,
      ...prepared.state,
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
      action: "admin.course_created",
      resourceType: "course",
      resourceId: courseId,
      metadata: { slug: prepared.state.slug, contentHash },
      createdAt: now,
    }),
  ]);
  return { course: await getAdminCourse(db, courseId), warnings: prepared.warnings };
}

export async function updateAdminCourse(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
  input: UpdateAdminCourseInput,
): Promise<{ course: AdminCourseView; warnings: CourseWarnings }> {
  const current = await getCourseRow(db, courseId);
  const merged = mergeCourseInput(current, input);
  if (merged.slug !== current.slug) {
    await ensureCourseSlugAvailable(db, merged.slug, courseId);
  }
  const prepared = await prepareCourseState(db, merged);
  const contentHash = await hashCourseContent(prepared.state);
  const now = new Date();
  await db.batch([
    db
      .update(courses)
      .set({ ...prepared.state, contentHash, updatedAt: now })
      .where(eq(courses.id, courseId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_updated",
      resourceType: "course",
      resourceId: courseId,
      metadata: {
        changedFields: Object.keys(input),
        previousContentHash: current.contentHash,
        contentHash,
      },
      createdAt: now,
    }),
  ]);
  return { course: await getAdminCourse(db, courseId), warnings: prepared.warnings };
}

export async function publishAdminCourse(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
) {
  const current = await getCourseRow(db, courseId);
  if (!canPublishCourseContent(current.status)) {
    throw new CourseServiceError("INVALID_COURSE_TRANSITION", "当前课程状态不能发布", 409);
  }
  const now = new Date();
  await db.batch([
    db
      .update(courses)
      .set({
        status: "published",
        publishedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(courses.id, courseId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_published",
      resourceType: "course",
      resourceId: courseId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);
  return getAdminCourse(db, courseId);
}

export async function archiveAdminCourse(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
) {
  const current = await getCourseRow(db, courseId);
  if (!canArchiveCourseContent(current.status)) {
    throw new CourseServiceError("INVALID_COURSE_TRANSITION", "只有已发布课程可以归档", 409);
  }
  const now = new Date();
  await db.batch([
    db
      .update(courses)
      .set({ status: "archived", updatedAt: now })
      .where(eq(courses.id, courseId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_archived",
      resourceType: "course",
      resourceId: courseId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);
  return getAdminCourse(db, courseId);
}

export async function listAdminChapters(db: AppDatabase, courseId: string) {
  await getCourseRow(db, courseId);
  const rows = await db
    .select()
    .from(courseChapters)
    .where(
      and(eq(courseChapters.courseId, courseId), isNull(courseChapters.deletedAt)),
    )
    .orderBy(
      asc(courseChapters.position),
      asc(courseChapters.createdAt),
      asc(courseChapters.title),
    );
  return rows.map(toChapterView);
}

export async function getAdminChapter(
  db: AppDatabase,
  courseId: string,
  chapterId: string,
) {
  await getCourseRow(db, courseId);
  return toChapterView(await getChapterRow(db, courseId, chapterId));
}

export async function createAdminChapter(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
  input: CreateAdminChapterInput,
): Promise<{ chapter: AdminChapterView; warnings: CourseWarnings }> {
  await getCourseRow(db, courseId);
  await ensureChapterSlugAvailable(db, courseId, input.slug);
  const prepared = await prepareChapterState(db, chapterInputState(input));
  const contentHash = await hashChapterContent(prepared.state);
  const chapterId = generateId();
  const now = new Date();
  await db.batch([
    db.insert(courseChapters).values({
      id: chapterId,
      courseId,
      ...prepared.state,
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
      action: "admin.course_chapter_created",
      resourceType: "course_chapter",
      resourceId: chapterId,
      metadata: { courseId, slug: prepared.state.slug, contentHash },
      createdAt: now,
    }),
  ]);
  return {
    chapter: await getAdminChapter(db, courseId, chapterId),
    warnings: prepared.warnings,
  };
}

export async function updateAdminChapter(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
  chapterId: string,
  input: UpdateAdminChapterInput,
): Promise<{ chapter: AdminChapterView; warnings: CourseWarnings }> {
  await getCourseRow(db, courseId);
  const current = await getChapterRow(db, courseId, chapterId);
  const merged = mergeChapterInput(current, input);
  if (merged.slug !== current.slug) {
    await ensureChapterSlugAvailable(db, courseId, merged.slug, chapterId);
  }
  const prepared = await prepareChapterState(db, merged);
  const contentHash = await hashChapterContent(prepared.state);
  const now = new Date();
  await db.batch([
    db
      .update(courseChapters)
      .set({ ...prepared.state, contentHash, updatedAt: now })
      .where(eq(courseChapters.id, chapterId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_chapter_updated",
      resourceType: "course_chapter",
      resourceId: chapterId,
      metadata: {
        courseId,
        changedFields: Object.keys(input),
        previousContentHash: current.contentHash,
        contentHash,
      },
      createdAt: now,
    }),
  ]);
  return {
    chapter: await getAdminChapter(db, courseId, chapterId),
    warnings: prepared.warnings,
  };
}

export async function publishAdminChapter(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
  chapterId: string,
) {
  const course = await getCourseRow(db, courseId);
  const current = await getChapterRow(db, courseId, chapterId);
  if (!canPublishChapterWithinCourse({
    courseStatus: course.status,
    courseDeleted: course.deletedAt !== null,
  })) {
    throw new CourseServiceError(
      "COURSE_NOT_PUBLISHABLE",
      "归档或删除的课程不能发布章节",
      409,
    );
  }
  if (!canPublishCourseContent(current.status)) {
    throw new CourseServiceError("INVALID_CHAPTER_TRANSITION", "当前章节状态不能发布", 409);
  }
  const now = new Date();
  await db.batch([
    db
      .update(courseChapters)
      .set({
        status: "published",
        publishedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(courseChapters.id, chapterId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_chapter_published",
      resourceType: "course_chapter",
      resourceId: chapterId,
      metadata: { courseId, previousStatus: current.status },
      createdAt: now,
    }),
  ]);
  return getAdminChapter(db, courseId, chapterId);
}

export async function archiveAdminChapter(
  db: AppDatabase,
  actorUserId: string,
  courseId: string,
  chapterId: string,
) {
  await getCourseRow(db, courseId);
  const current = await getChapterRow(db, courseId, chapterId);
  if (!canArchiveCourseContent(current.status)) {
    throw new CourseServiceError("INVALID_CHAPTER_TRANSITION", "只有已发布章节可以归档", 409);
  }
  const now = new Date();
  await db.batch([
    db
      .update(courseChapters)
      .set({ status: "archived", updatedAt: now })
      .where(eq(courseChapters.id, chapterId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.course_chapter_archived",
      resourceType: "course_chapter",
      resourceId: chapterId,
      metadata: { courseId, previousStatus: current.status },
      createdAt: now,
    }),
  ]);
  return getAdminChapter(db, courseId, chapterId);
}
