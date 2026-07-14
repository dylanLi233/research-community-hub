import { describe, expect, it } from "vitest";

import {
  createAdminChapterSchema,
  createAdminCourseSchema,
  updateAdminChapterSchema,
  updateAdminCourseSchema,
} from "./validation";

const course = {
  title: "看懂宏观经济",
  subtitle: "从增长、通胀到资产价格",
  slug: "understand-macro-economy",
  summary: "建立宏观经济与资产价格之间的基础分析框架。",
  descriptionHtml: "<p>课程简介</p>",
  coverAssetId: null,
  instructorName: "研究编辑部",
  tags: ["宏观", " 宏观 ", "资产配置"],
  accessLevel: "member" as const,
  seoTitle: null,
  seoDescription: null,
};

const chapter = {
  title: "第一章：经济增长从哪里来",
  slug: "where-growth-comes-from",
  summary: "理解增长的供给与需求来源。",
  bodyHtml: "<p>公开试读</p><!-- PAYWALL --><p>会员正文</p>",
  accessLevel: "member" as const,
  previewMode: "paywall_marker" as const,
  position: 1,
  estimatedMinutes: 18,
};

describe("course request validation", () => {
  it("normalizes duplicate course tags", () => {
    const parsed = createAdminCourseSchema.parse(course);
    expect(parsed.tags).toEqual(["宏观", "资产配置"]);
  });

  it("rejects invalid course slugs and empty updates", () => {
    expect(
      createAdminCourseSchema.safeParse({ ...course, slug: "Bad--Slug" })
        .success,
    ).toBe(false);
    expect(updateAdminCourseSchema.safeParse({}).success).toBe(false);
  });

  it("accepts valid chapter position and estimated reading time", () => {
    expect(createAdminChapterSchema.parse(chapter)).toMatchObject({
      position: 1,
      estimatedMinutes: 18,
    });
  });

  it("rejects invalid chapter ordering, duration and slugs", () => {
    expect(
      createAdminChapterSchema.safeParse({ ...chapter, position: 0 }).success,
    ).toBe(false);
    expect(
      createAdminChapterSchema.safeParse({
        ...chapter,
        estimatedMinutes: 601,
      }).success,
    ).toBe(false);
    expect(
      createAdminChapterSchema.safeParse({ ...chapter, slug: "Bad Slug" })
        .success,
    ).toBe(false);
    expect(updateAdminChapterSchema.safeParse({}).success).toBe(false);
  });
});
