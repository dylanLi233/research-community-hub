import { describe, expect, it } from "vitest";

import { isReportPubliclyVisible } from "./public-policy";

const now = new Date("2026-07-14T12:00:00Z");
const visible = {
  status: "published" as const,
  accessLevel: "member" as const,
  publishedAt: new Date("2026-07-14T10:00:00Z"),
  scheduledAt: null,
  deletedAt: null,
};

describe("public report visibility", () => {
  it("shows currently published public and member reports", () => {
    expect(isReportPubliclyVisible(visible, now)).toBe(true);
    expect(
      isReportPubliclyVisible({ ...visible, accessLevel: "public" }, now),
    ).toBe(true);
  });

  it("hides non-published and private reports", () => {
    for (const status of [
      "draft",
      "pending_review",
      "rejected",
      "archived",
    ] as const) {
      expect(isReportPubliclyVisible({ ...visible, status }, now)).toBe(false);
    }

    expect(
      isReportPubliclyVisible({ ...visible, accessLevel: "private" }, now),
    ).toBe(false);
  });

  it("hides deleted, unpublished and future-published reports", () => {
    expect(
      isReportPubliclyVisible({ ...visible, deletedAt: new Date() }, now),
    ).toBe(false);
    expect(
      isReportPubliclyVisible({ ...visible, publishedAt: null }, now),
    ).toBe(false);
    expect(
      isReportPubliclyVisible(
        { ...visible, publishedAt: new Date("2026-07-15T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });

  it("hides reports until their scheduled time", () => {
    expect(
      isReportPubliclyVisible(
        { ...visible, scheduledAt: new Date("2026-07-14T13:00:00Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isReportPubliclyVisible(
        { ...visible, scheduledAt: new Date("2026-07-14T11:00:00Z") },
        now,
      ),
    ).toBe(true);
  });
});
