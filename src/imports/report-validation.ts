import { z } from "zod";

import { isValidCalendarDate, normalizeReportTags } from "@/reports/validation";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const tagsSchema = z
  .array(z.string().max(30))
  .max(10)
  .transform(normalizeReportTags);

export const importReportSchema = z
  .object({
    external_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    subtitle: nullableText(300),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug 只能包含小写字母、数字和单个连字符分隔",
      ),
    summary: z.string().trim().min(1).max(2000),
    body_html: z.string().min(1),
    access_level: z.enum(["public", "member", "private"]),
    preview_mode: z.enum(["none", "paywall_marker", "summary_only"]),
    source: z
      .object({
        institution: z.string().trim().min(1).max(120),
        report_date: z
          .string()
          .refine(isValidCalendarDate, "原报告日期必须是有效的 YYYY-MM-DD")
          .nullable()
          .optional(),
      })
      .strict(),
    author_name: nullableText(120),
    cover_asset_id: z.uuid().nullable().optional(),
    tags: tagsSchema.default([]),
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
    title: value.title,
    subtitle: value.subtitle ?? null,
    slug: value.slug,
    summary: value.summary,
    bodyHtml: value.body_html,
    accessLevel: value.access_level,
    previewMode: value.preview_mode,
    sourceInstitution: value.source.institution,
    sourceReportDate: value.source.report_date ?? null,
    authorName: value.author_name ?? null,
    coverAssetId: value.cover_asset_id ?? null,
    tags: value.tags,
    scheduledAt: null,
    seoTitle: value.seo?.title ?? null,
    seoDescription: value.seo?.description ?? null,
  }));

export type ImportReportInput = z.infer<typeof importReportSchema>;
