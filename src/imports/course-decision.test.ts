import { describe, expect, it } from "vitest";

import {
  canImportChapterToCourse,
  decideCourseImportAction,
  decideCourseImportOutcome,
} from "./course-decision";

describe("course import decisions", () => {
  it("decides created, updated and unchanged from hashes", () => {
    expect(decideCourseImportAction(null, "a")).toBe("created");
    expect(decideCourseImportAction("a", "a")).toBe("unchanged");
    expect(decideCourseImportAction("a", "b")).toBe("updated");
  });

  it("uses review mode only for changed content", () => {
    expect(
      decideCourseImportOutcome({
        action: "created",
        currentStatus: null,
        reviewMode: "on",
      }),
    ).toEqual({ status: "pending_review", httpStatus: 202 });
    expect(
      decideCourseImportOutcome({
        action: "updated",
        currentStatus: "published",
        reviewMode: "off",
      }),
    ).toEqual({ status: "published", httpStatus: 200 });
    expect(
      decideCourseImportOutcome({
        action: "unchanged",
        currentStatus: "archived",
        reviewMode: "off",
      }),
    ).toEqual({ status: "archived", httpStatus: 200 });
  });
});

describe("chapter parent course policy", () => {
  it("accepts active course workflow states", () => {
    for (const status of [
      "draft",
      "pending_review",
      "published",
      "rejected",
    ] as const) {
      expect(canImportChapterToCourse({ status, deleted: false })).toBe(true);
    }
  });

  it("rejects archived or deleted parents", () => {
    expect(
      canImportChapterToCourse({ status: "archived", deleted: false }),
    ).toBe(false);
    expect(
      canImportChapterToCourse({ status: "draft", deleted: true }),
    ).toBe(false);
  });
});
