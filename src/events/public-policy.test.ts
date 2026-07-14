import { describe, expect, it } from "vitest";

import {
  canReadEventDetails,
  formatEventTime,
  projectPublicEvent,
  type PublicEventSource,
} from "./public-policy";

const event: PublicEventSource = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "美联储议息会议",
  eventDate: "2026-07-29",
  startsAt: new Date("2026-07-29T18:00:00Z"),
  endsAt: new Date("2026-07-29T19:00:00Z"),
  timezone: "America/New_York",
  allDay: false,
  category: "central_bank",
  importance: "high",
  region: "美国",
  summary: "关注政策利率和会后声明。",
  impact: "影响美元、美债和全球风险资产。",
  focusPoints: ["政策利率", "通胀判断"],
  sourceName: "Federal Reserve",
  sourceUrl: "https://www.federalreserve.gov/",
  tags: ["美联储"],
  accessLevel: "member",
};

describe("public event projection", () => {
  it("shows all fields for public events", () => {
    const projected = projectPublicEvent(
      { ...event, accessLevel: "public" },
      "visitor",
    );

    expect(projected.impact).toBe(event.impact);
    expect(projected.focusPoints).toEqual(event.focusPoints);
    expect(projected.restricted).toBe(false);
  });

  it("removes member impact and focus fields for visitors", () => {
    const projected = projectPublicEvent(event, "visitor");
    const serialized = JSON.stringify(projected);

    expect(projected.impact).toBeNull();
    expect(projected.focusPoints).toEqual([]);
    expect(projected.restricted).toBe(true);
    expect(serialized).not.toContain("影响美元");
    expect(serialized).not.toContain("通胀判断");
  });

  it("allows members and administrators to read member details", () => {
    expect(canReadEventDetails("member", "member")).toBe(true);
    expect(canReadEventDetails("member", "admin")).toBe(true);
    expect(projectPublicEvent(event, "member").impact).toBe(event.impact);
  });

  it("formats all-day, pending and timezone-local times", () => {
    expect(
      formatEventTime({
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: "Asia/Shanghai",
      }),
    ).toBe("全天");
    expect(
      formatEventTime({
        allDay: false,
        startsAt: null,
        endsAt: null,
        timezone: "Asia/Shanghai",
      }),
    ).toBe("时间待定");
    expect(
      formatEventTime({
        allDay: false,
        startsAt: "2026-07-29T18:00:00.000Z",
        endsAt: "2026-07-29T19:00:00.000Z",
        timezone: "America/New_York",
      }),
    ).toBe("14:00–15:00");
  });
});
