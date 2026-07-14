import { describe, expect, it } from "vitest";

import {
  createAdminEventSchema,
  dateInTimezone,
  isValidIanaTimezone,
  normalizeFocusPoints,
} from "./validation";

const baseEvent = {
  title: "美联储议息会议",
  eventDate: "2026-07-29",
  startsAt: "2026-07-29T14:00:00-04:00",
  endsAt: "2026-07-29T15:00:00-04:00",
  timezone: "America/New_York",
  allDay: false,
  category: "central_bank" as const,
  importance: "high" as const,
  region: "美国",
  summary: "关注政策利率与会后声明。",
  impact: "可能影响美元、美债和全球风险资产。",
  focusPoints: ["点阵图", " 通胀判断 ", "点阵图"],
  sourceName: "Federal Reserve",
  sourceUrl: "https://www.federalreserve.gov/",
  tags: ["美联储", "利率"],
  accessLevel: "public" as const,
};

describe("market event validation", () => {
  it("validates IANA timezones and formats dates in that timezone", () => {
    expect(isValidIanaTimezone("Asia/Shanghai")).toBe(true);
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Mars/Olympus")).toBe(false);
    expect(
      dateInTimezone(
        new Date("2026-07-30T01:00:00Z"),
        "America/New_York",
      ),
    ).toBe("2026-07-29");
  });

  it("normalizes focus points and removes duplicates", () => {
    expect(normalizeFocusPoints([" 点阵图 ", "点阵图", "通胀判断", ""])).toEqual([
      "点阵图",
      "通胀判断",
    ]);
  });

  it("parses a valid timed event", () => {
    const parsed = createAdminEventSchema.parse(baseEvent);

    expect(parsed.startsAt).toBeInstanceOf(Date);
    expect(parsed.endsAt).toBeInstanceOf(Date);
    expect(parsed.focusPoints).toEqual(["点阵图", "通胀判断"]);
  });

  it("rejects impossible dates, bad timezone and mismatched local dates", () => {
    expect(
      createAdminEventSchema.safeParse({ ...baseEvent, eventDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      createAdminEventSchema.safeParse({ ...baseEvent, timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
    expect(
      createAdminEventSchema.safeParse({
        ...baseEvent,
        eventDate: "2026-07-28",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid time ranges and timed fields on all-day events", () => {
    expect(
      createAdminEventSchema.safeParse({
        ...baseEvent,
        endsAt: "2026-07-29T13:00:00-04:00",
      }).success,
    ).toBe(false);
    expect(
      createAdminEventSchema.safeParse({
        ...baseEvent,
        allDay: true,
      }).success,
    ).toBe(false);
    expect(
      createAdminEventSchema.safeParse({
        ...baseEvent,
        startsAt: null,
        endsAt: "2026-07-29T15:00:00-04:00",
      }).success,
    ).toBe(false);
  });

  it("accepts an all-day event without timestamps", () => {
    expect(
      createAdminEventSchema.safeParse({
        ...baseEvent,
        startsAt: null,
        endsAt: null,
        allDay: true,
      }).success,
    ).toBe(true);
  });
});
