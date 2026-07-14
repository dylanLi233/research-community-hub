import { describe, expect, it } from "vitest";

import {
  importChapterSchema,
  importCourseSchema,
} from "./course-validation";
import { PAYWALL_MARKER } from "@/content/types";

const course = {
  external_id: "macro-course-v1",
  title: "看懂宏观经济",
  subtitle: "从增长与通胀到资产价格",
  slug: "understand-macro-economy",
  summary: "建立宏观分析框架。",
  description_html: "<p>课程简介</p>",
  cover_asset_id: null,
  instructor_name: "研究编辑部",
  tags: ["宏观", " 宏观 ", "资产配置"],
  access_level: "member" as const,
  seo: {
    title: "看懂宏观经济课程",
    description: "宏观经济基础课程。",
  },
};

const chapter = {
  external_id: "chapter-growth-v1",
  title: "经济增长从哪里来",
  slug: "where-growth-comes-from",
  summary: "理解增长来源。",
  body_html: `<p>公开试读</p>${PAYWALL_MARKER}<p>会员正文</p>`,
  access_level: "member" as const,
  preview_mode: "paywall_marker" as const,
  position: 1,
  estimated_minutes: 18,
};

describe("Hermes course payload", () => {
  it("transforms strict snake_case course fields", () => {
    const parsed = importCourseSchema.parse(course);

    expect(parsed.externalId).toBe("macro-course-v1");
    expect(parsed.course).toMatchObject({
      slug: "understand-macro-economy",
      tags: ["宏观", "资产配置"],
      accessLevel: "member",
      coverAssetId: null,
    });
  });

  it("rejects unknown fields and invalid slugs", () => {
    expect(
      importCourseSchema.safeParse({ ...course, guessed_outline: [] }).success,
    ).toBe(false);
    expect(
      importCourseSchema.safeParse({ ...course, slug: "Bad--Slug" }).success,
    ).toBe(false);
  });
});

describe("Hermes chapter payload", () => {
  it("transforms chapter ordering and access fields", () => {
    const parsed = importChapterSchema.parse(chapter);

    expect(parsed).toMatchObject({
      externalId: "chapter-growth-v1",
      chapter: {
        position: 1,
        estimatedMinutes: 18,
        accessLevel: "member",
        previewMode: "paywall_marker",
      },
    });
  });

  it("rejects invalid ordering, duration and unknown fields", () => {
    expect(
      importChapterSchema.safeParse({ ...chapter, position: 0 }).success,
    ).toBe(false);
    expect(
      importChapterSchema.safeParse({ ...chapter, estimated_minutes: 601 })
        .success,
    ).toBe(false);
    expect(
      importChapterSchema.safeParse({ ...chapter, video_url: "x" }).success,
    ).toBe(false);
  });
});
