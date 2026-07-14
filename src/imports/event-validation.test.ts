import { describe, expect, it } from "vitest";

import { importEventSchema } from "./event-validation";

const payload = {
  external_id: "fed-fomc-2026-07-29",
  title: "美联储 7 月议息会议",
  event_date: "2026-07-29",
  starts_at: "2026-07-29T14:00:00-04:00",
  ends_at: "2026-07-29T15:00:00-04:00",
  timezone: "America/New_York",
  all_day: false,
  category: "central_bank" as const,
  importance: "high" as const,
  region: "美国",
  summary: "关注政策利率和会后声明。",
  impact: "影响美元、美债和全球风险资产。",
  focus_points: ["政策利率", " 通胀判断 ", "政策利率"],
  source_name: "Federal Reserve",
  source_url: "https://www.federalreserve.gov/",
  tags: ["美联储", "利率"],
  access_level: "public" as const,
};

describe("Hermes market event payload", () => {
  it("transforms strict snake_case input to normalized internal fields", () => {
    const result = importEventSchema.parse(payload);

    expect(result.externalId).toBe("fed-fomc-2026-07-29");
    expect(result.event.startsAt).toBeInstanceOf(Date);
    expect(result.event.endsAt).toBeInstanceOf(Date);
    expect(result.event.focusPoints).toEqual(["政策利率", "通胀判断"]);
  });

  it("rejects unknown fields", () => {
    expect(
      importEventSchema.safeParse({ ...payload, guessed_impact: true }).success,
    ).toBe(false);
  });

  it("rejects invalid date, timezone and time range", () => {
    expect(
      importEventSchema.safeParse({ ...payload, event_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      importEventSchema.safeParse({ ...payload, timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
    expect(
      importEventSchema.safeParse({
        ...payload,
        ends_at: "2026-07-29T13:00:00-04:00",
      }).success,
    ).toBe(false);
  });

  it("requires a stable external id and valid enum values", () => {
    const { external_id: _externalId, ...withoutExternalId } = payload;

    expect(importEventSchema.safeParse(withoutExternalId).success).toBe(false);
    expect(
      importEventSchema.safeParse({ ...payload, category: "unknown" }).success,
    ).toBe(false);
    expect(
      importEventSchema.safeParse({ ...payload, importance: "critical" })
        .success,
    ).toBe(false);
  });
});
