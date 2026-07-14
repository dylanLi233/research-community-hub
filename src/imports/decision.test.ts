import { describe, expect, it } from "vitest";

import {
  decideReportImportAction,
  decideReportImportOutcome,
} from "./decision";

describe("report import action decision", () => {
  it("creates when no prior report exists", () => {
    expect(decideReportImportAction(null, "hash-a")).toBe("created");
  });

  it("returns unchanged for an equal content hash", () => {
    expect(decideReportImportAction("hash-a", "hash-a")).toBe("unchanged");
  });

  it("updates when the content hash changes", () => {
    expect(decideReportImportAction("hash-a", "hash-b")).toBe("updated");
  });
});

describe("report import publication outcome", () => {
  it("routes changed reports to review while review mode is on", () => {
    expect(
      decideReportImportOutcome({
        action: "created",
        currentStatus: null,
        reviewMode: "on",
      }),
    ).toEqual({ status: "pending_review", httpStatus: 202 });

    expect(
      decideReportImportOutcome({
        action: "updated",
        currentStatus: "published",
        reviewMode: "on",
      }),
    ).toEqual({ status: "pending_review", httpStatus: 202 });
  });

  it("publishes immediately while review mode is off", () => {
    expect(
      decideReportImportOutcome({
        action: "created",
        currentStatus: null,
        reviewMode: "off",
      }),
    ).toEqual({ status: "published", httpStatus: 201 });

    expect(
      decideReportImportOutcome({
        action: "updated",
        currentStatus: "archived",
        reviewMode: "off",
      }),
    ).toEqual({ status: "published", httpStatus: 200 });
  });

  it("preserves the current status for unchanged content", () => {
    expect(
      decideReportImportOutcome({
        action: "unchanged",
        currentStatus: "pending_review",
        reviewMode: "off",
      }),
    ).toEqual({ status: "pending_review", httpStatus: 200 });
  });
});
