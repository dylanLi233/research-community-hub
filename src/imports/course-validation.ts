import { z } from "zod";

import {
  createAdminChapterSchema,
  createAdminCourseSchema,
} from "@/courses/validation";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const importCourseSchema = z
  .object({
    external_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    subtitle: nullableText(300),
    slug: z.string(),
    summary: z.string().trim().min(1).max(2000),
    description_html: z.string().min(1),
    cover_asset_id: z.uuid().nullable().optional(),
    instructor_name: nullableText(120),
    tags: z.array(z.string().max(30)).max(10).default([]),
    access_level: z.enum(["public", "member", "private"]).default("member"),
    seo: z
      .object({
        title: nullableText(200),
        description: nullableText(300),
      })
      .strict()
      .optional(),
  })
  .strict()
  .transform((value) => ({
    externalId: value.external_id,
    course: {
      title: value.title,
      subtitle: value.subtitle ?? null,
      slug: value.slug,
      summary: value.summary,
      descriptionHtml: value.description_html,
      coverAssetId: value.cover_asset_id ?? null,
      instructorName: value.instructor_name ?? null,
      tags: value.tags,
      accessLevel: value.access_level,
      seoTitle: value.seo?.title ?? null,
      seoDescription: value.seo?.description ?? null,
    },
  }))
  .superRefine((value, context) => {
    const parsed = createAdminCourseSchema.safeParse(value.course);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [
            issue.path[0] === "descriptionHtml"
              ? "description_html"
              : issue.path[0] === "coverAssetId"
                ? "cover_asset_id"
                : issue.path[0] === "instructorName"
                  ? "instructor_name"
                  : issue.path[0] === "accessLevel"
                    ? "access_level"
                    : issue.path[0] === "seoTitle"
                      ? "seo.title"
                      : issue.path[0] === "seoDescription"
                        ? "seo.description"
                        : String(issue.path[0] ?? "course"),
          ],
          message: issue.message,
        });
      }
    }
  })
  .transform((value) => {
    const course = createAdminCourseSchema.parse(value.course);
    return {
      externalId: value.externalId,
      course: {
        title: course.title,
        subtitle: course.subtitle ?? null,
        slug: course.slug,
        summary: course.summary,
        descriptionHtml: course.descriptionHtml,
        coverAssetId: course.coverAssetId ?? null,
        instructorName: course.instructorName ?? null,
        tags: course.tags,
        accessLevel: course.accessLevel,
        seoTitle: course.seoTitle ?? null,
        seoDescription: course.seoDescription ?? null,
      },
    };
  });

export const importChapterSchema = z
  .object({
    external_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    slug: z.string(),
    summary: z.string().trim().min(1).max(2000),
    body_html: z.string().min(1),
    access_level: z.enum(["public", "member", "private"]),
    preview_mode: z.enum(["none", "paywall_marker", "summary_only"]),
    position: z.number().int(),
    estimated_minutes: z.number().int().nullable().optional(),
  })
  .strict()
  .transform((value) => ({
    externalId: value.external_id,
    chapter: {
      title: value.title,
      slug: value.slug,
      summary: value.summary,
      bodyHtml: value.body_html,
      accessLevel: value.access_level,
      previewMode: value.preview_mode,
      position: value.position,
      estimatedMinutes: value.estimated_minutes ?? null,
    },
  }))
  .superRefine((value, context) => {
    const parsed = createAdminChapterSchema.safeParse(value.chapter);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [
            issue.path[0] === "bodyHtml"
              ? "body_html"
              : issue.path[0] === "accessLevel"
                ? "access_level"
                : issue.path[0] === "previewMode"
                  ? "preview_mode"
                  : issue.path[0] === "estimatedMinutes"
                    ? "estimated_minutes"
                    : String(issue.path[0] ?? "chapter"),
          ],
          message: issue.message,
        });
      }
    }
  })
  .transform((value) => {
    const chapter = createAdminChapterSchema.parse(value.chapter);
    return {
      externalId: value.externalId,
      chapter: {
        title: chapter.title,
        slug: chapter.slug,
        summary: chapter.summary,
        bodyHtml: chapter.bodyHtml,
        accessLevel: chapter.accessLevel,
        previewMode: chapter.previewMode,
        position: chapter.position,
        estimatedMinutes: chapter.estimatedMinutes ?? null,
      },
    };
  });

export type ImportCourseInput = z.infer<typeof importCourseSchema>;
export type ImportChapterInput = z.infer<typeof importChapterSchema>;
