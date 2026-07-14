import { describe, expect, it } from "vitest";

import { importReportSchema } from "./report-validation";
import { PAYWALL_MARKER } from "@/content/types";

const validPayload = {
  external_id: "gs-ai-capex-2026-07-10",
  title: "高盛：全球 AI 资本开支进入第二阶段",
  subtitle: "云厂商投资重心正在变化",
  slug: "goldman-ai-capex-second-stage",
  summary: "报告讨论 AI 基础设施资本开支的变化。",
  body_html: `<p>公开试读</p>${PAYWALL_MARKER}<p>会员正文</p>`,
  access_level: "member" as const,
  preview_mode: "paywall_marker" as const,
  source: {
    institution: "Goldman Sachs",
    report_date: "2026-07-10",
  },
  author_name: "研究编辑部",
  cover_asset_id: null,
  tags: ["AI", " ai ", "算力"],
  seo: {
    title: "高盛 AI 资本开支研报精读",
    description: "高盛最新 AI 基础设施投资观点。",
  },
};

describe("Hermes report payload", () => {
  it("transforms strict snake_case input to internal fields", () => {
    const result = importReportSchema.parse(validPayload);

    expect(result).toMatchObject({
      externalId: "gs-ai-capex-2026-07-10",
      bodyHtml: validPayload.body_html,
      accessLevel: "member",
      previewMode: "paywall_marker",
      sourceInstitution: "Goldman Sachs",
      sourceReportDate: "2026-07-10",
      coverAssetId: null,
      tags: ["AI", "算力"],
      scheduledAt: null,
    });
  });

  it("rejects unknown fields instead of silently accepting them", () => {
    expect(
      importReportSchema.safeParse({
        ...validPayload,
        website_should_guess_this: true,
      }).success,
    ).toBe(false);
  });

  it("requires source metadata and a stable external id", () => {
    const { source: _source, ...withoutSource } = validPayload;
    const { external_id: _externalId, ...withoutExternalId } = validPayload;

    expect(importReportSchema.safeParse(withoutSource).success).toBe(false);
    expect(importReportSchema.safeParse(withoutExternalId).success).toBe(false);
  });

  it("rejects impossible dates, invalid slugs and excessive tags", () => {
    expect(
      importReportSchema.safeParse({
        ...validPayload,
        source: { ...validPayload.source, report_date: "2026-02-30" },
      }).success,
    ).toBe(false);
    expect(
      importReportSchema.safeParse({ ...validPayload, slug: "Bad--Slug" })
        .success,
    ).toBe(false);
    expect(
      importReportSchema.safeParse({
        ...validPayload,
        tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
      }).success,
    ).toBe(false);
  });
});
