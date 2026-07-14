import { z } from "zod";

import { isValidCalendarDate, normalizeReportTags } from "@/reports/validation";

export const EVENT_CATEGORIES = [
  "macro",
  "policy",
  "central_bank",
  "economic_data",
  "industry",
  "company",
  "earnings",
  "market",
  "geopolitics",
  "other",
] as const;

export const EVENT_IMPORTANCE = ["high", "medium", "low"] as const;
export const EVENT_ACCESS_LEVELS = ["public", "member", "private"] as const;

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function normalizeFocusPoints(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.normalize("NFKC").trim();

    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("zh-CN");

    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

const eventDateSchema = z
  .string()
  .refine(isValidCalendarDate, "事件日期必须是有效的 YYYY-MM-DD");
const timestampSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .nullable()
  .optional();
const focusPointsSchema = z
  .array(z.string().max(300))
  .max(8)
  .transform(normalizeFocusPoints);
const tagsSchema = z
  .array(z.string().max(30))
  .max(10)
  .transform(normalizeReportTags);
const sourceUrlSchema = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "来源地址仅支持 HTTP 或 HTTPS")
  .nullable()
  .optional();

const eventFields = {
  title: z.string().trim().min(1).max(200),
  eventDate: eventDateSchema,
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isValidIanaTimezone, "必须提供有效的 IANA 时区")
    .default("Asia/Shanghai"),
  allDay: z.boolean().default(false),
  category: z.enum(EVENT_CATEGORIES),
  importance: z.enum(EVENT_IMPORTANCE).default("medium"),
  region: nullableTrimmed(120),
  summary: z.string().trim().min(1).max(2000),
  impact: nullableTrimmed(3000),
  focusPoints: focusPointsSchema.default([]),
  sourceName: nullableTrimmed(200),
  sourceUrl: sourceUrlSchema,
  tags: tagsSchema.default([]),
  accessLevel: z.enum(EVENT_ACCESS_LEVELS).default("public"),
};

function validateEventTiming(
  value: {
    eventDate?: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
    timezone?: string;
    allDay?: boolean;
  },
  context: z.RefinementCtx,
): void {
  if (value.allDay && (value.startsAt || value.endsAt)) {
    context.addIssue({
      code: "custom",
      path: ["startsAt"],
      message: "全天事件不能提供开始或结束时间",
    });
  }

  if (value.endsAt && !value.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "提供结束时间时必须同时提供开始时间",
    });
  }

  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "结束时间必须晚于开始时间",
    });
  }

  if (
    value.eventDate &&
    value.startsAt &&
    value.timezone &&
    dateInTimezone(value.startsAt, value.timezone) !== value.eventDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["startsAt"],
      message: "开始时间在指定时区下必须属于 eventDate",
    });
  }
}

export const createAdminEventSchema = z
  .object(eventFields)
  .superRefine(validateEventTiming);

export const updateAdminEventSchema = z
  .object({
    title: eventFields.title.optional(),
    eventDate: eventFields.eventDate.optional(),
    startsAt: eventFields.startsAt,
    endsAt: eventFields.endsAt,
    timezone: eventFields.timezone.optional(),
    allDay: eventFields.allDay.optional(),
    category: eventFields.category.optional(),
    importance: eventFields.importance.optional(),
    region: eventFields.region,
    summary: eventFields.summary.optional(),
    impact: eventFields.impact,
    focusPoints: focusPointsSchema.optional(),
    sourceName: eventFields.sourceName,
    sourceUrl: eventFields.sourceUrl,
    tags: tagsSchema.optional(),
    accessLevel: eventFields.accessLevel.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

export const eventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).optional(),
  dateFrom: eventDateSchema.optional(),
  dateTo: eventDateSchema.optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  importance: z.enum(EVENT_IMPORTANCE).optional(),
  status: z
    .enum(["draft", "pending_review", "published", "rejected", "archived"])
    .optional(),
  accessLevel: z.enum(EVENT_ACCESS_LEVELS).optional(),
});

export type CreateAdminEventInput = z.infer<typeof createAdminEventSchema>;
export type UpdateAdminEventInput = z.infer<typeof updateAdminEventSchema>;
export type EventListQueryInput = z.infer<typeof eventListQuerySchema>;
