import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
} from "drizzle-orm";

import { orderCourseChapters } from "./public-policy";
import type { AppDatabase } from "@/db/client";
import { courseChapters, courses } from "@/db/courses-schema";

export type PublicCourseCard = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  coverAssetId: string | null;
  coverUrl: string | null;
  instructorName: string | null;
  tags: string[];
  accessLevel: "public" | "member";
  publishedAt: string;
  chapterCount: number;
  totalEstimatedMinutes: number;
};

export type PublicCourseChapterCard = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  accessLevel: "public" | "member";
  previewMode: "none" | "paywall_marker" | "summary_only";
  position: number;
  estimatedMinutes: number | null;
  publishedAt: string;
  createdAt: string;
};

export type PublicCourseDetail = PublicCourseCard & {
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  chapters: PublicCourseChapterCard[];
};

export type PublicCourseChapterDetail = PublicCourseChapterCard & {
  bodyHtml: string;
};

export type PublicCourseChapterPageData = {
  course: PublicCourseDetail;
  chapter: PublicCourseChapterDetail;
  previousChapter: PublicCourseChapterCard | null;
  nextChapter: PublicCourseChapterCard | null;
};

function courseConditions(now: Date) {
  return and(
    eq(courses.status, "published"),
    ne(courses.accessLevel, "private"),
    isNull(courses.deletedAt),
    lte(courses.publishedAt, now),
  );
}

function chapterConditions(courseId: string, now: Date) {
  return and(
    eq(courseChapters.courseId, courseId),
    eq(courseChapters.status, "published"),
    ne(courseChapters.accessLevel, "private"),
    isNull(courseChapters.deletedAt),
    lte(courseChapters.publishedAt, now),
  );
}

function toCourseCard(
  row: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    summary: string;
    coverAssetId: string | null;
    instructorName: string | null;
    tags: string[];
    accessLevel: "public" | "member" | "private";
    publishedAt: Date | null;
  },
  statistics: { chapterCount: number; totalEstimatedMinutes: number },
): PublicCourseCard {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    summary: row.summary,
    coverAssetId: row.coverAssetId,
    coverUrl: row.coverAssetId ? `/media/${row.coverAssetId}` : null,
    instructorName: row.instructorName,
    tags: row.tags,
    accessLevel: row.accessLevel === "public" ? "public" : "member",
    publishedAt: row.publishedAt!.toISOString(),
    chapterCount: statistics.chapterCount,
    totalEstimatedMinutes: statistics.totalEstimatedMinutes,
  };
}

function toChapterCard(row: {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  position: number;
  estimatedMinutes: number | null;
  publishedAt: Date | null;
  createdAt: Date;
}): PublicCourseChapterCard {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    accessLevel: row.accessLevel === "public" ? "public" : "member",
    previewMode: row.previewMode,
    position: row.position,
    estimatedMinutes: row.estimatedMinutes,
    publishedAt: row.publishedAt!.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadChapterStatistics(
  db: AppDatabase,
  courseIds: string[],
  now: Date,
): Promise<Map<string, { chapterCount: number; totalEstimatedMinutes: number }>> {
  const statistics = new Map<
    string,
    { chapterCount: number; totalEstimatedMinutes: number }
  >();

  for (const courseId of courseIds) {
    statistics.set(courseId, { chapterCount: 0, totalEstimatedMinutes: 0 });
  }

  if (courseIds.length === 0) {
    return statistics;
  }

  const rows = await db
    .select({
      courseId: courseChapters.courseId,
      estimatedMinutes: courseChapters.estimatedMinutes,
    })
    .from(courseChapters)
    .where(
      and(
        inArray(courseChapters.courseId, courseIds),
        eq(courseChapters.status, "published"),
        ne(courseChapters.accessLevel, "private"),
        isNull(courseChapters.deletedAt),
        lte(courseChapters.publishedAt, now),
      ),
    );

  for (const row of rows) {
    const current = statistics.get(row.courseId) ?? {
      chapterCount: 0,
      totalEstimatedMinutes: 0,
    };
    current.chapterCount += 1;
    current.totalEstimatedMinutes += row.estimatedMinutes ?? 0;
    statistics.set(row.courseId, current);
  }

  return statistics;
}

export async function listPublicCourses(
  db: AppDatabase,
  input: { page: number; pageSize: number; now?: Date },
): Promise<{ items: PublicCourseCard[]; total: number }> {
  const now = input.now ?? new Date();
  const where = courseConditions(now);
  const [{ total }] = await db.select({ total: count() }).from(courses).where(where);
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      subtitle: courses.subtitle,
      slug: courses.slug,
      summary: courses.summary,
      coverAssetId: courses.coverAssetId,
      instructorName: courses.instructorName,
      tags: courses.tags,
      accessLevel: courses.accessLevel,
      publishedAt: courses.publishedAt,
    })
    .from(courses)
    .where(where)
    .orderBy(desc(courses.publishedAt), desc(courses.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);
  const statistics = await loadChapterStatistics(
    db,
    rows.map((row) => row.id),
    now,
  );

  return {
    items: rows.map((row) =>
      toCourseCard(
        row,
        statistics.get(row.id) ?? {
          chapterCount: 0,
          totalEstimatedMinutes: 0,
        },
      ),
    ),
    total,
  };
}

async function listVisibleCourseChapters(
  db: AppDatabase,
  courseId: string,
  now: Date,
): Promise<PublicCourseChapterCard[]> {
  const rows = await db
    .select({
      id: courseChapters.id,
      courseId: courseChapters.courseId,
      title: courseChapters.title,
      slug: courseChapters.slug,
      summary: courseChapters.summary,
      accessLevel: courseChapters.accessLevel,
      previewMode: courseChapters.previewMode,
      position: courseChapters.position,
      estimatedMinutes: courseChapters.estimatedMinutes,
      publishedAt: courseChapters.publishedAt,
      createdAt: courseChapters.createdAt,
    })
    .from(courseChapters)
    .where(chapterConditions(courseId, now))
    .orderBy(
      asc(courseChapters.position),
      asc(courseChapters.createdAt),
      asc(courseChapters.title),
    );

  return orderCourseChapters(rows).map(toChapterCard);
}

export async function getPublicCourseBySlug(
  db: AppDatabase,
  slug: string,
  now = new Date(),
): Promise<PublicCourseDetail | null> {
  const [row] = await db
    .select({
      id: courses.id,
      title: courses.title,
      subtitle: courses.subtitle,
      slug: courses.slug,
      summary: courses.summary,
      descriptionHtml: courses.descriptionHtml,
      coverAssetId: courses.coverAssetId,
      instructorName: courses.instructorName,
      tags: courses.tags,
      accessLevel: courses.accessLevel,
      publishedAt: courses.publishedAt,
      seoTitle: courses.seoTitle,
      seoDescription: courses.seoDescription,
    })
    .from(courses)
    .where(and(courseConditions(now), eq(courses.slug, slug)))
    .limit(1);

  if (!row) {
    return null;
  }

  const chapters = await listVisibleCourseChapters(db, row.id, now);
  const statistics = {
    chapterCount: chapters.length,
    totalEstimatedMinutes: chapters.reduce(
      (total, chapter) => total + (chapter.estimatedMinutes ?? 0),
      0,
    ),
  };

  return {
    ...toCourseCard(row, statistics),
    descriptionHtml: row.descriptionHtml,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    chapters,
  };
}

export async function getPublicCourseChapterBySlugs(
  db: AppDatabase,
  courseSlug: string,
  chapterSlug: string,
  now = new Date(),
): Promise<PublicCourseChapterPageData | null> {
  const course = await getPublicCourseBySlug(db, courseSlug, now);

  if (!course) {
    return null;
  }

  const chapterIndex = course.chapters.findIndex(
    (chapter) => chapter.slug === chapterSlug,
  );

  if (chapterIndex === -1) {
    return null;
  }

  const [chapter] = await db
    .select({
      id: courseChapters.id,
      courseId: courseChapters.courseId,
      title: courseChapters.title,
      slug: courseChapters.slug,
      summary: courseChapters.summary,
      bodyHtml: courseChapters.bodyHtml,
      accessLevel: courseChapters.accessLevel,
      previewMode: courseChapters.previewMode,
      position: courseChapters.position,
      estimatedMinutes: courseChapters.estimatedMinutes,
      publishedAt: courseChapters.publishedAt,
      createdAt: courseChapters.createdAt,
    })
    .from(courseChapters)
    .where(
      and(
        chapterConditions(course.id, now),
        eq(courseChapters.slug, chapterSlug),
      ),
    )
    .limit(1);

  if (!chapter) {
    return null;
  }

  return {
    course,
    chapter: { ...toChapterCard(chapter), bodyHtml: chapter.bodyHtml },
    previousChapter: course.chapters[chapterIndex - 1] ?? null,
    nextChapter: course.chapters[chapterIndex + 1] ?? null,
  };
}
