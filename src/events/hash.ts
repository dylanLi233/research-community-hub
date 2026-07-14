export type EventHashInput = {
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
  accessLevel: "public" | "member" | "private";
};

export async function hashEventContent(input: EventHashInput): Promise<string> {
  const canonical = JSON.stringify({
    title: input.title,
    eventDate: input.eventDate,
    startsAt: input.startsAt?.toISOString() ?? null,
    endsAt: input.endsAt?.toISOString() ?? null,
    timezone: input.timezone,
    allDay: input.allDay,
    category: input.category,
    importance: input.importance,
    region: input.region,
    summary: input.summary,
    impact: input.impact,
    focusPoints: input.focusPoints,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    tags: input.tags,
    accessLevel: input.accessLevel,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );

  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
