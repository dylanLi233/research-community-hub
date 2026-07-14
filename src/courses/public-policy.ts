import { renderContentHtml } from "@/content/render";
import type {
  ContentAccessLevel,
  ContentAudience,
  ContentPreviewMode,
} from "@/content/types";

export type PublishableCourseRecord = {
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  accessLevel: ContentAccessLevel;
  publishedAt: Date | null;
  deletedAt: Date | null;
};

export type OrderedChapterRecord = {
  id: string;
  position: number;
  createdAt: Date;
  title: string;
};

export type ChapterProjectionInput = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
  position: number;
  estimatedMinutes: number | null;
};

export type PublicChapterProjection = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  html: string;
  accessLevel: "public" | "member";
  previewMode: ContentPreviewMode;
  position: number;
  estimatedMinutes: number | null;
  hasFullAccess: boolean;
  isRestricted: boolean;
};

export function isPublicCourseRecordVisible(
  record: PublishableCourseRecord,
  now = new Date(),
): boolean {
  return (
    record.status === "published" &&
    record.accessLevel !== "private" &&
    record.deletedAt === null &&
    record.publishedAt !== null &&
    record.publishedAt.getTime() <= now.getTime()
  );
}

export const isPublicChapterRecordVisible = isPublicCourseRecordVisible;

export function orderCourseChapters<T extends OrderedChapterRecord>(
  chapters: readonly T[],
): T[] {
  return [...chapters].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    const createdDifference = left.createdAt.getTime() - right.createdAt.getTime();

    if (createdDifference !== 0) {
      return createdDifference;
    }

    const titleDifference = left.title.localeCompare(right.title, "zh-CN");
    return titleDifference !== 0 ? titleDifference : left.id.localeCompare(right.id);
  });
}

export function projectChapterForAudience(
  chapter: ChapterProjectionInput,
  audience: ContentAudience,
): PublicChapterProjection {
  const rendered = renderContentHtml({
    bodyHtml: chapter.bodyHtml,
    accessLevel: chapter.accessLevel,
    previewMode: chapter.previewMode,
    audience,
  });

  return {
    id: chapter.id,
    courseId: chapter.courseId,
    title: chapter.title,
    slug: chapter.slug,
    summary: chapter.summary,
    html: rendered.html,
    accessLevel: chapter.accessLevel === "public" ? "public" : "member",
    previewMode: chapter.previewMode,
    position: chapter.position,
    estimatedMinutes: chapter.estimatedMinutes,
    hasFullAccess: rendered.hasFullAccess,
    isRestricted: rendered.isRestricted,
  };
}
