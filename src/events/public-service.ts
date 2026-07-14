import {
  and,
  asc,
  eq,
  gte,
  isNull,
  lte,
  ne,
} from "drizzle-orm";

import type { ContentAudience } from "@/content/types";
import type { AppDatabase } from "@/db/client";
import { marketEvents } from "@/db/events-schema";
import {
  projectPublicEvent,
  type PublicEventSource,
  type PublicEventView,
} from "./public-policy";

const importanceRank = { high: 0, medium: 1, low: 2 } as const;

export async function listPublicEventsForWeek(
  db: AppDatabase,
  input: {
    weekStart: string;
    weekEnd: string;
    audience: ContentAudience;
    now?: Date;
  },
): Promise<PublicEventView[]> {
  const now = input.now ?? new Date();
  const rows = await db
    .select({
      id: marketEvents.id,
      title: marketEvents.title,
      eventDate: marketEvents.eventDate,
      startsAt: marketEvents.startsAt,
      endsAt: marketEvents.endsAt,
      timezone: marketEvents.timezone,
      allDay: marketEvents.allDay,
      category: marketEvents.category,
      importance: marketEvents.importance,
      region: marketEvents.region,
      summary: marketEvents.summary,
      impact: marketEvents.impact,
      focusPoints: marketEvents.focusPoints,
      sourceName: marketEvents.sourceName,
      sourceUrl: marketEvents.sourceUrl,
      tags: marketEvents.tags,
      accessLevel: marketEvents.accessLevel,
    })
    .from(marketEvents)
    .where(
      and(
        eq(marketEvents.status, "published"),
        ne(marketEvents.accessLevel, "private"),
        isNull(marketEvents.deletedAt),
        lte(marketEvents.publishedAt, now),
        gte(marketEvents.eventDate, input.weekStart),
        lte(marketEvents.eventDate, input.weekEnd),
      ),
    )
    .orderBy(asc(marketEvents.eventDate), asc(marketEvents.startsAt));

  return rows
    .map((row) =>
      projectPublicEvent(
        {
          ...row,
          accessLevel:
            row.accessLevel === "public" ? "public" : "member",
        } satisfies PublicEventSource,
        input.audience,
      ),
    )
    .sort((left, right) => {
      if (left.eventDate !== right.eventDate) {
        return left.eventDate.localeCompare(right.eventDate);
      }

      if (left.allDay !== right.allDay) {
        return left.allDay ? -1 : 1;
      }

      const leftTime = left.startsAt ?? "";
      const rightTime = right.startsAt ?? "";

      if (leftTime !== rightTime) {
        return leftTime.localeCompare(rightTime);
      }

      const importanceDifference =
        importanceRank[left.importance] - importanceRank[right.importance];

      return importanceDifference || left.title.localeCompare(right.title, "zh-CN");
    });
}
