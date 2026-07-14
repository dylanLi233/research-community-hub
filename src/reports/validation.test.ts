import { describe, expect, it } from "vitest";

import {
  createAdminReportSchema,
  isValidCalendarDate,
  normalizeReportTags,
  updateAdminReportSchema,
} from "./validation";

const validReport = {
  title: "高盛：AI 资本开支进入第二阶段",
  slug: "goldman-ai-capex-second-stage",
  summary: "研报摘要",
  bodyHtml: "<p>正文</p>",
  accessLevel: "public" as const,
  previewMode: "none" as const,
  sourceInstitution: "Goldman Sachs",
  sourceReportDate: "2026-07-10",
  tags: ["AI", " 算力 ", "ai"],
};

describe("report request validation", () => {
  it("validates real calendar dates", () => {
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2026-7-1")).toBe(false);
  });

  it("normalizes and deduplicates tags", () => {
    expect(normalizeReportTags([" AI ", "ai", "ＡＩ", "算力", ""])).toEqual([
      "AI",
      "算力",
    ]);
  });

  it("parses a valid create payload and applies nullable defaults", () => {
    const parsed = createAdminReportSchema.parse(validReport);

    expect(parsed.tags).toEqual(["AI", "算力"]);
    expect(parsed.subtitle).toBeUndefined();
    expect(parsed.coverAssetId).toBeUndefined();
  });

  it("rejects invalid slugs and impossible dates", () => {
    expect(
      createAdminReportSchema.safeParse({ ...validReport, slug: "Bad--Slug" })
        .success,
    ).toBe(false);
    expect(
      createAdminReportSchema.safeParse({
        ...validReport,
        sourceReportDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("rejects empty update requests", () => {
    expect(updateAdminReportSchema.safeParse({}).success).toBe(false);
  });
});
