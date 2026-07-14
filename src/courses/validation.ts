import { z } from "zod";

import { normalizeReportTags } from "@/reports/validation";

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug 只能包含小写字母、数字和单个连字符分隔",
  );
const tagsSchema = z
  .array(z.string().max(30))
  .max(10)
  .transform(normalizeReportTags);
const accessLevelSchema = z.enum(["public", "member", "private"]);

const courseFields = {
  title: z.string().trim().min(1).max(200),
  subtitle: nullableTrimmed(300),
  slug: slugSchema,
  summary: z.string().trim().min(1).max(2000),
  descriptionHtml: z.string().min(1),
  coverAssetId: z.uuid().nullable().optional(),
  instructorName: nullableTrimmed(120),
  tags: tagsSchema.default([]),
  accessLevel: accessLevelSchema.default("member"),
  seoTitle: nullableTrimmed(200),
  seoDescription: nullableTrimmed(300),
};

export const createAdminCourseSchema = z.object(courseFields);

export const updateAdminCourseSchema = z
  .object({
    title: courseFields.title.optional(),
    subtitle: courseFields.subtitle,
    slug: courseFields.slug.optional(),
    summary: courseFields.summary.optional(),
    descriptionHtml: courseFields.descriptionHtml.optional(),
    coverAssetId: courseFields.coverAssetId,
    instructorName: courseFields.instructorName,
    tags: tagsSchema.optional(),
    accessLevel: accessLevelSchema.optional(),
    seoTitle: courseFields.seoTitle,
    seoDescription: courseFields.seoDescription,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

const chapterFields = {
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  summary: z.string().trim().min(1).max(2000),
  bodyHtml: z.string().min(1),
  accessLevel: accessLevelSchema,
  previewMode: z.enum(["none", "paywall_marker", "summary_only"]),
  position: z.number().int().min(1).max(9999),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
};

export const createAdminChapterSchema = z.object(chapterFields);

export const updateAdminChapterSchema = z
  .object({
    title: chapterFields.title.optional(),
    slug: chapterFields.slug.optional(),
    summary: chapterFields.summary.optional(),
    bodyHtml: chapterFields.bodyHtml.optional(),
    accessLevel: chapterFields.accessLevel.optional(),
    previewMode: chapterFields.previewMode.optional(),
    position: chapterFields.position.optional(),
    estimatedMinutes: chapterFields.estimatedMinutes,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

export const courseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).optional(),
  status: z
    .enum(["draft", "pending_review", "published", "rejected", "archived"])
    .optional(),
  accessLevel: accessLevelSchema.optional(),
});

export type CreateAdminCourseInput = z.infer<typeof createAdminCourseSchema>;
export type UpdateAdminCourseInput = z.infer<typeof updateAdminCourseSchema>;
export type CreateAdminChapterInput = z.infer<typeof createAdminChapterSchema>;
export type UpdateAdminChapterInput = z.infer<typeof updateAdminChapterSchema>;
export type CourseListQueryInput = z.infer<typeof courseListQuerySchema>;
