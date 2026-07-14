import { z } from "zod";

import {
  createAdminEventSchema,
  EVENT_ACCESS_LEVELS,
  EVENT_CATEGORIES,
  EVENT_IMPORTANCE,
} from "@/events/validation";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const importEventSchema = z
  .object({
    external_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    event_date: z.string(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    timezone: z.string().trim().min(1).max(80).default("Asia/Shanghai"),
    all_day: z.boolean().default(false),
    category: z.enum(EVENT_CATEGORIES),
    importance: z.enum(EVENT_IMPORTANCE).default("medium"),
    region: nullableText(120),
    summary: z.string().trim().min(1).max(2000),
    impact: nullableText(3000),
    focus_points: z.array(z.string().max(300)).max(8).default([]),
    source_name: nullableText(200),
    source_url: z.string().nullable().optional(),
    tags: z.array(z.string().max(30)).max(10).default([]),
    access_level: z.enum(EVENT_ACCESS_LEVELS).default("public"),
  })
  .strict()
  .transform((value) => ({
    externalId: value.external_id,
    event: {
      title: value.title,
      eventDate: value.event_date,
      startsAt: value.starts_at,
      endsAt: value.ends_at,
      timezone: value.timezone,
      allDay: value.all_day,
      category: value.category,
      importance: value.importance,
      region: value.region ?? null,
      summary: value.summary,
      impact: value.impact ?? null,
      focusPoints: value.focus_points,
      sourceName: value.source_name ?? null,
      sourceUrl: value.source_url ?? null,
      tags: value.tags,
      accessLevel: value.access_level,
    },
  }))
  .superRefine((value, context) => {
    const parsed = createAdminEventSchema.safeParse(value.event);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [
            issue.path[0] === "eventDate"
              ? "event_date"
              : issue.path[0] === "startsAt"
                ? "starts_at"
                : issue.path[0] === "endsAt"
                  ? "ends_at"
                  : issue.path[0] === "allDay"
                    ? "all_day"
                    : issue.path[0] === "focusPoints"
                      ? "focus_points"
                      : issue.path[0] === "sourceName"
                        ? "source_name"
                        : issue.path[0] === "sourceUrl"
                          ? "source_url"
                          : issue.path[0] === "accessLevel"
                            ? "access_level"
                            : String(issue.path[0] ?? "event"),
          ],
          message: issue.message,
        });
      }
    }
  })
  .transform((value) => {
    const event = createAdminEventSchema.parse(value.event);
    return { externalId: value.externalId, event };
  });

export type ImportEventInput = z.infer<typeof importEventSchema>;
