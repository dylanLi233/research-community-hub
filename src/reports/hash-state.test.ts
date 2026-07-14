import { describe, expect, it } from "vitest";

import { hashReportContent, type ReportHashInput } from "./hash";
import { canArchiveReport, canPublishReport } from "./state";

const report: ReportHashInput = {
  title: "研报标题",
  subtitle: null,
  slug: "report-title",
  summary: "摘要",
  bodyHtml: "<p>正文</p>",
  accessLevel: "public",
  previewMode: "none",
  sourceInstitution: "Institution",
  sourceReportDate: "2026-07-10",
  authorName: null,
  coverAssetId: null,
  tags: ["AI"],
  scheduledAt: null,
  seoTitle: null,
  seoDescription: null,
};

describe("report content hash", () => {
  it("is stable for identical content and changes with meaningful fields", async () => {
    const first = await hashReportContent(report);
    const second = await hashReportContent({ ...report });
    const changed = await hashReportContent({ ...report, summary: "新的摘要" });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });
});

describe("report state transitions", () => {
  it("allows draft, review, rejected and archived reports to publish", () => {
    expect(canPublishReport("draft")).toBe(true);
    expect(canPublishReport("pending_review")).toBe(true);
    expect(canPublishReport("rejected")).toBe(true);
    expect(canPublishReport("archived")).toBe(true);
    expect(canPublishReport("published")).toBe(false);
  });

  it("allows only published reports to archive", () => {
    expect(canArchiveReport("published")).toBe(true);
    expect(canArchiveReport("draft")).toBe(false);
    expect(canArchiveReport("archived")).toBe(false);
  });
});
