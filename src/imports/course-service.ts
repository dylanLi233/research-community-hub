import { and, eq, inArray, ne } from "drizzle-orm";

import {
  canImportChapterToCourse,
  decideCourseImportAction,
  decideCourseImportOutcome,
} from "./course-decision";
import type {
  ImportChapterInput,
  ImportCourseInput,
} from "./course-validation";
import type { ImportResponseBody } from "./log-service";
import {
  hashChapterContent,
  hashCourseContent,
  type ChapterHashInput,
  type CourseHashInput,
} from "@/courses/hash";
import {
  collectCourseAssetIds,
  validateChapterAssetReferences,
  validateCourseAssetReferences,
} from "@/courses/media-policy";
import { generateId } from "@/auth/token";
import { prepareContentHtml } from "@/content/pipeline";
import { ContentHtmlError } from "@/content/types";
import { assets } from "@/db/assets-schema";
import type { AppDatabase } from "@/db/client";
import { courseChapters, courses } from "@/db/courses-schema";
import { importResponseSnapshots } from "@/db/import-schema";
import { auditLogs, importRequests } from "@/db/schema";
import { getReviewMode } from "@/integrations/review-mode";
import { extractMediaAssetIds } from "@/reports/media-policy";

export class ImportCourseServiceError extends Error {
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
    this.name = "ImportCourseServiceError";
  }
}

type ContentWarnings = ReturnType<typeof prepareContentHtml>["warnings"];

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

function htmlError(
  error: ContentHtmlError,
  field: string,
): ImportCourseServiceError {
  return new ImportCourseServiceError(error.code, error.message, 422, [
    { field, code: error.code, message: error.message },
  ]);
}

function assetError(
  issues: Array<{ field: string; code: string; message: string }>,
): ImportCourseServiceError {
  return new ImportCourseServiceError(
    "COURSE_ASSET_VALIDATION_FAILED",
    "课程引用的素材未通过校验",
    422,
    issues,
  );
}

async function prepareCourse(
  db: AppDatabase,
  input: CourseHashInput,
): Promise<{ state: CourseHashInput; warnings: ContentWarnings }> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.descriptionHtml,
      accessLevel: "public",
      previewMode: "none",
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw htmlError(error, "description_html");
    }
    throw error;
  }

  const state = { ...input, descriptionHtml: prepared.bodyHtml };
  const records = await loadAssetRecords(
    db,
    collectCourseAssetIds({
      coverAssetId: state.coverAssetId,
      descriptionHtml: state.descriptionHtml,
    }),
  );
  const issues = validateCourseAssetReferences({
    coverAssetId: state.coverAssetId,
    descriptionHtml: state.descriptionHtml,
    assets: records,
  });

  if (issues.length > 0) {
    throw assetError(
      issues.map((issue) => ({
        field:
          issue.field === "coverAssetId"
            ? "cover_asset_id"
            : "description_html",
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return { state, warnings: prepared.warnings };
}

async function prepareChapter(
  db: AppDatabase,
  input: ChapterHashInput,
): Promise<{ state: ChapterHashInput; warnings: ContentWarnings }> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.bodyHtml,
      accessLevel: input.accessLevel,
      previewMode: input.previewMode,
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw htmlError(error, "body_html");
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
        field: "body_html",
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
): Promise<void> {
  const conditions = [eq(courses.slug, slug)];
  if (excludingId) conditions.push(ne(courses.id, excludingId));
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new ImportCourseServiceError(
      "COURSE_SLUG_CONFLICT",
      "课程 Slug 已被使用",
      409,
      [
        {
          field: "slug",
          code: "COURSE_SLUG_CONFLICT",
          message: "课程 Slug 必须全站唯一",
        },
      ],
    );
  }
}

async function ensureChapterSlugAvailable(
  db: AppDatabase,
  courseId: string,
  slug: string,
  excludingId?: string,
): Promise<void> {
  const conditions = [
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
    throw new ImportCourseServiceError(
      "CHAPTER_SLUG_CONFLICT",
      "章节 Slug 已被使用",
      409,
      [
        {
          field: "slug",
          code: "CHAPTER_SLUG_CONFLICT",
          message: "章节 Slug 在同一课程内必须唯一",
        },
      ],
    );
  }
}

function courseResponse(input: {
  requestId: string;
  clientRequestId: string | null;
  action: "created" | "updated" | "unchanged";
  courseId: string;
  externalId: string;
  status: string;
  slug: string;
  warnings: ContentWarnings;
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    data: {
      action: input.action,
      course_id: input.courseId,
      external_id: input.externalId,
      status: input.status,
      url: `/courses/${input.slug}`,
      warnings: input.warnings,
    },
  };
}

function chapterResponse(input: {
  requestId: string;
  clientRequestId: string | null;
  action: "created" | "updated" | "unchanged";
  courseId: string;
  courseExternalId: string;
  courseSlug: string;
  chapterId: string;
  externalId: string;
  status: string;
  slug: string;
  warnings: ContentWarnings;
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    data: {
      action: input.action,
      course_id: input.courseId,
      course_external_id: input.courseExternalId,
      chapter_id: input.chapterId,
      external_id: input.externalId,
      status: input.status,
      url: `/courses/${input.courseSlug}/${input.slug}`,
      warnings: input.warnings,
    },
  };
}

export async function importCourse(
  db: AppDatabase,
  input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    requestId: string;
    clientRequestId: string | null;
    payload: ImportCourseInput;
    startedAt: number;
  },
): Promise<{ httpStatus: number; body: ImportResponseBody }> {
  const [existing] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.importedByApiClientId, input.apiClientId),
        eq(courses.externalId, input.payload.externalId),
      ),
    )
    .limit(1);

  if (existing?.deletedAt) {
    throw new ImportCourseServiceError(
      "COURSE_EXTERNAL_ID_DELETED",
      "该 external_id 对应的课程已删除，不能自动恢复",
      409,
    );
  }

  const prepared = await prepareCourse(db, input.payload.course);
  const contentHash = await hashCourseContent(prepared.state);
  const action = decideCourseImportAction(
    existing?.contentHash ?? null,
    contentHash,
  );
  const reviewMode = await getReviewMode(db);
  const outcome = decideCourseImportOutcome({
    action,
    currentStatus: existing?.status ?? null,
    reviewMode,
  });
  const courseId = existing?.id ?? generateId();
  const now = new Date();
  const durationMs = Date.now() - input.startedAt;
  const body = courseResponse({
    requestId: input.requestId,
    clientRequestId: input.clientRequestId,
    action,
    courseId,
    externalId: input.payload.externalId,
    status: outcome.status,
    slug: prepared.state.slug,
    warnings: prepared.warnings,
  });
  const importResult = prepared.warnings.length > 0 ? "warning" : "success";

  if (action !== "unchanged") {
    await ensureCourseSlugAvailable(db, prepared.state.slug, existing?.id);
  }

  if (action === "created") {
    await db.batch([
      db.insert(courses).values({
        id: courseId,
        externalId: input.payload.externalId,
        ...prepared.state,
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
        endpoint: "/api/v1/import/courses",
        externalId: input.payload.externalId,
        contentType: "course",
        result: importResult,
        httpStatus: outcome.httpStatus,
        resourceType: "course",
        resourceId: courseId,
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
        action: "api.course_created",
        resourceType: "course",
        resourceId: courseId,
        metadata: {
          externalId: input.payload.externalId,
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
        .update(courses)
        .set({
          ...prepared.state,
          status: outcome.status,
          publishedAt:
            outcome.status === "published" ? now : existing!.publishedAt,
          rejectionReason: null,
          contentHash,
          updatedAt: now,
        })
        .where(eq(courses.id, courseId)),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/courses",
        externalId: input.payload.externalId,
        contentType: "course",
        result: importResult,
        httpStatus: outcome.httpStatus,
        resourceType: "course",
        resourceId: courseId,
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
        action: "api.course_updated",
        resourceType: "course",
        resourceId: courseId,
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
        endpoint: "/api/v1/import/courses",
        externalId: input.payload.externalId,
        contentType: "course",
        result: importResult,
        httpStatus: 200,
        resourceType: "course",
        resourceId: courseId,
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
        action: "api.course_unchanged",
        resourceType: "course",
        resourceId: courseId,
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

export async function importCourseChapter(
  db: AppDatabase,
  input: {
    apiClientId: string;
    courseExternalId: string;
    idempotencyKey: string;
    requestHash: string;
    requestId: string;
    clientRequestId: string | null;
    payload: ImportChapterInput;
    startedAt: number;
  },
): Promise<{ httpStatus: number; body: ImportResponseBody }> {
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.importedByApiClientId, input.apiClientId),
        eq(courses.externalId, input.courseExternalId),
      ),
    )
    .limit(1);

  if (!course) {
    throw new ImportCourseServiceError(
      "COURSE_EXTERNAL_ID_NOT_FOUND",
      "父课程不存在，网站不会自动创建缺失课程",
      404,
      [
        {
          field: "course_external_id",
          code: "COURSE_EXTERNAL_ID_NOT_FOUND",
          message: "请先导入父课程",
        },
      ],
    );
  }

  if (
    !canImportChapterToCourse({
      status: course.status,
      deleted: course.deletedAt !== null,
    })
  ) {
    throw new ImportCourseServiceError(
      course.deletedAt
        ? "COURSE_EXTERNAL_ID_DELETED"
        : "COURSE_ARCHIVED",
      course.deletedAt
        ? "父课程已删除，不能导入章节"
        : "父课程已归档，不能导入章节",
      409,
    );
  }

  const [existing] = await db
    .select()
    .from(courseChapters)
    .where(
      and(
        eq(courseChapters.courseId, course.id),
        eq(courseChapters.externalId, input.payload.externalId),
      ),
    )
    .limit(1);

  if (existing?.deletedAt) {
    throw new ImportCourseServiceError(
      "CHAPTER_EXTERNAL_ID_DELETED",
      "该 external_id 对应的章节已删除，不能自动恢复",
      409,
    );
  }

  const prepared = await prepareChapter(db, input.payload.chapter);
  const contentHash = await hashChapterContent(prepared.state);
  const action = decideCourseImportAction(
    existing?.contentHash ?? null,
    contentHash,
  );
  const reviewMode = await getReviewMode(db);
  const outcome = decideCourseImportOutcome({
    action,
    currentStatus: existing?.status ?? null,
    reviewMode,
  });
  const chapterId = existing?.id ?? generateId();
  const now = new Date();
  const durationMs = Date.now() - input.startedAt;
  const body = chapterResponse({
    requestId: input.requestId,
    clientRequestId: input.clientRequestId,
    action,
    courseId: course.id,
    courseExternalId: input.courseExternalId,
    courseSlug: course.slug,
    chapterId,
    externalId: input.payload.externalId,
    status: outcome.status,
    slug: prepared.state.slug,
    warnings: prepared.warnings,
  });
  const importResult = prepared.warnings.length > 0 ? "warning" : "success";

  if (action !== "unchanged") {
    await ensureChapterSlugAvailable(
      db,
      course.id,
      prepared.state.slug,
      existing?.id,
    );
  }

  const endpoint = `/api/v1/import/courses/${input.courseExternalId}/chapters`;

  if (action === "created") {
    await db.batch([
      db.insert(courseChapters).values({
        id: chapterId,
        courseId: course.id,
        externalId: input.payload.externalId,
        ...prepared.state,
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
        endpoint,
        externalId: input.payload.externalId,
        contentType: "course_chapter",
        result: importResult,
        httpStatus: outcome.httpStatus,
        resourceType: "course_chapter",
        resourceId: chapterId,
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
        action: "api.course_chapter_created",
        resourceType: "course_chapter",
        resourceId: chapterId,
        metadata: {
          courseId: course.id,
          courseExternalId: input.courseExternalId,
          externalId: input.payload.externalId,
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
        .update(courseChapters)
        .set({
          ...prepared.state,
          status: outcome.status,
          publishedAt:
            outcome.status === "published" ? now : existing!.publishedAt,
          rejectionReason: null,
          contentHash,
          updatedAt: now,
        })
        .where(eq(courseChapters.id, chapterId)),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint,
        externalId: input.payload.externalId,
        contentType: "course_chapter",
        result: importResult,
        httpStatus: outcome.httpStatus,
        resourceType: "course_chapter",
        resourceId: chapterId,
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
        action: "api.course_chapter_updated",
        resourceType: "course_chapter",
        resourceId: chapterId,
        metadata: {
          courseId: course.id,
          courseExternalId: input.courseExternalId,
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
        endpoint,
        externalId: input.payload.externalId,
        contentType: "course_chapter",
        result: importResult,
        httpStatus: 200,
        resourceType: "course_chapter",
        resourceId: chapterId,
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
        action: "api.course_chapter_unchanged",
        resourceType: "course_chapter",
        resourceId: chapterId,
        metadata: {
          courseId: course.id,
          courseExternalId: input.courseExternalId,
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

export async function getImportedCourseSummary(
  db: AppDatabase,
  apiClientId: string,
  externalId: string,
): Promise<Record<string, unknown> | null> {
  const [course] = await db
    .select({
      id: courses.id,
      externalId: courses.externalId,
      title: courses.title,
      slug: courses.slug,
      accessLevel: courses.accessLevel,
      status: courses.status,
      publishedAt: courses.publishedAt,
      updatedAt: courses.updatedAt,
      deletedAt: courses.deletedAt,
    })
    .from(courses)
    .where(
      and(
        eq(courses.importedByApiClientId, apiClientId),
        eq(courses.externalId, externalId),
      ),
    )
    .limit(1);

  if (!course || course.deletedAt) return null;

  return {
    course_id: course.id,
    external_id: course.externalId,
    title: course.title,
    slug: course.slug,
    access_level: course.accessLevel,
    status: course.status,
    published_at: course.publishedAt?.toISOString() ?? null,
    updated_at: course.updatedAt.toISOString(),
    url: `/courses/${course.slug}`,
  };
}

export async function getImportedChapterSummary(
  db: AppDatabase,
  apiClientId: string,
  courseExternalId: string,
  chapterExternalId: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({
      courseId: courses.id,
      courseSlug: courses.slug,
      courseDeletedAt: courses.deletedAt,
      chapterId: courseChapters.id,
      externalId: courseChapters.externalId,
      title: courseChapters.title,
      slug: courseChapters.slug,
      accessLevel: courseChapters.accessLevel,
      previewMode: courseChapters.previewMode,
      position: courseChapters.position,
      estimatedMinutes: courseChapters.estimatedMinutes,
      status: courseChapters.status,
      publishedAt: courseChapters.publishedAt,
      updatedAt: courseChapters.updatedAt,
      deletedAt: courseChapters.deletedAt,
    })
    .from(courses)
    .innerJoin(courseChapters, eq(courseChapters.courseId, courses.id))
    .where(
      and(
        eq(courses.importedByApiClientId, apiClientId),
        eq(courses.externalId, courseExternalId),
        eq(courseChapters.externalId, chapterExternalId),
      ),
    )
    .limit(1);

  if (!row || row.courseDeletedAt || row.deletedAt) return null;

  return {
    course_id: row.courseId,
    course_external_id: courseExternalId,
    chapter_id: row.chapterId,
    external_id: row.externalId,
    title: row.title,
    slug: row.slug,
    access_level: row.accessLevel,
    preview_mode: row.previewMode,
    position: row.position,
    estimated_minutes: row.estimatedMinutes,
    status: row.status,
    published_at: row.publishedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
    url: `/courses/${row.courseSlug}/${row.slug}`,
  };
}
