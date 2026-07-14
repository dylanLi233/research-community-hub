import { z } from "zod";

const nullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeReportTags(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const tag = value.normalize("NFKC").trim();

    if (!tag) {
      continue;
    }

    const key = tag.toLocaleLowerCase("zh-CN");

    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(tag);
    }
  }

  return normalized;
}

const sourceReportDateSchema = z
  .string()
  .refine(isValidCalendarDate, "原报告日期必须是有效的 YYYY-MM-DD")
  .nullable()
  .optional();

const reportTagsSchema = z
  .array(z.string().max(30))
  .max(10)
  .transform(normalizeReportTags)
  .refine((tags) => tags.length <= 10, "标签不能超过 10 个");

const reportFields = {
  title: z.string().trim().min(1).max(200),
  subtitle: nullableTrimmedString(300),
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
  bodyHtml: z.string().min(1),
  accessLevel: z.enum(["public", "member", "private"]),
  previewMode: z.enum(["none", "paywall_marker", "summary_only"]),
  sourceInstitution: z.string().trim().min(1).max(120),
  sourceReportDate: sourceReportDateSchema,
  authorName: nullableTrimmedString(120),
  coverAssetId: z.uuid().nullable().optional(),
  tags: reportTagsSchema.default([]),
  scheduledAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).nullable().optional(),
  seoTitle: nullableTrimmedString(200),
  seoDescription: nullableTrimmedString(300),
};

export const createAdminReportSchema = z.object(reportFields);

export const updateAdminReportSchema = z
  .object({
    title: reportFields.title.optional(),
    subtitle: reportFields.subtitle,
    slug: reportFields.slug.optional(),
    summary: reportFields.summary.optional(),
    bodyHtml: reportFields.bodyHtml.optional(),
    accessLevel: reportFields.accessLevel.optional(),
    previewMode: reportFields.previewMode.optional(),
    sourceInstitution: reportFields.sourceInstitution.optional(),
    sourceReportDate: reportFields.sourceReportDate,
    authorName: reportFields.authorName,
    coverAssetId: reportFields.coverAssetId,
    tags: reportTagsSchema.optional(),
    scheduledAt: reportFields.scheduledAt,
    seoTitle: reportFields.seoTitle,
    seoDescription: reportFields.seoDescription,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).optional(),
  status: z
    .enum(["draft", "pending_review", "published", "rejected", "archived"])
    .optional(),
  accessLevel: z.enum(["public", "member", "private"]).optional(),
  sourceInstitution: z.string().trim().max(120).optional(),
});

export type CreateAdminReportInput = z.infer<typeof createAdminReportSchema>;
export type UpdateAdminReportInput = z.infer<typeof updateAdminReportSchema>;
export type ReportListQueryInput = z.infer<typeof reportListQuerySchema>;
