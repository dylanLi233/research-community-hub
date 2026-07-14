import type { ContentAudience } from "@/content/types";

export type PublicEventSource = {
  id: string;
  title: string;
  eventDate: string;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  allDay: boolean;
  category:
    | "macro"
    | "policy"
    | "central_bank"
    | "economic_data"
    | "industry"
    | "company"
    | "earnings"
    | "market"
    | "geopolitics"
    | "other";
  importance: "high" | "medium" | "low";
  region: string | null;
  summary: string;
  impact: string | null;
  focusPoints: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  tags: string[];
  accessLevel: "public" | "member";
};

export type PublicEventView = Omit<
  PublicEventSource,
  "startsAt" | "endsAt" | "impact" | "focusPoints"
> & {
  startsAt: string | null;
  endsAt: string | null;
  impact: string | null;
  focusPoints: string[];
  restricted: boolean;
};

export function canReadEventDetails(
  accessLevel: PublicEventSource["accessLevel"],
  audience: ContentAudience,
): boolean {
  return (
    accessLevel === "public" || audience === "member" || audience === "admin"
  );
}

export function projectPublicEvent(
  event: PublicEventSource,
  audience: ContentAudience,
): PublicEventView {
  const fullAccess = canReadEventDetails(event.accessLevel, audience);

  return {
    ...event,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    impact: fullAccess ? event.impact : null,
    focusPoints: fullAccess ? event.focusPoints : [],
    restricted: !fullAccess,
  };
}

export function formatEventTime(input: {
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
}): string {
  if (input.allDay) {
    return "全天";
  }

  if (!input.startsAt) {
    return "时间待定";
  }

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: input.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const start = formatter.format(new Date(input.startsAt));

  if (!input.endsAt) {
    return start;
  }

  return `${start}–${formatter.format(new Date(input.endsAt))}`;
}
