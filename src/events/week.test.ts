import { describe, expect, it } from "vitest";

import { mondayForDate, resolveEventWeek, weekDates } from "./week";

describe("event week utilities", () => {
  it("normalizes weekdays and Sunday to Monday", () => {
    expect(mondayForDate("2026-07-14")).toBe("2026-07-13");
    expect(mondayForDate("2026-07-19")).toBe("2026-07-13");
    expect(mondayForDate("2026-07-20")).toBe("2026-07-20");
  });

  it("resolves a complete Monday-to-Sunday range", () => {
    expect(resolveEventWeek("2026-07-16")).toEqual({
      start: "2026-07-13",
      end: "2026-07-19",
      previous: "2026-07-06",
      next: "2026-07-20",
    });
  });

  it("falls back to the current date for invalid input", () => {
    expect(
      resolveEventWeek("not-a-date", new Date("2026-07-14T12:00:00Z")),
    ).toMatchObject({ start: "2026-07-13", end: "2026-07-19" });
  });

  it("lists exactly seven dates", () => {
    expect(weekDates("2026-07-13")).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });
});
