import { describe, expect, it } from "vitest";

import {
  hashChapterContent,
  hashCourseContent,
  type ChapterHashInput,
  type CourseHashInput,
} from "./hash";
import {
  canArchiveCourseContent,
  canPublishChapterWithinCourse,
  canPublishCourseContent,
} from "./state";

const course: CourseHashInput = {
  title: "看懂宏观经济",
  subtitle: null,
  slug: "understand-macro-economy",
  summary: "课程摘要",
  descriptionHtml: "<p>课程简介</p>",
  coverAssetId: null,
  instructorName: null,
  tags: ["宏观"],
  accessLevel: "member",
  seoTitle: null,
  seoDescription: null,
};

const chapter: ChapterHashInput = {
  title: "增长",
  slug: "growth",
  summary: "章节摘要",
  bodyHtml: "<p>正文</p>",
  accessLevel: "public",
  previewMode: "none",
  position: 1,
  estimatedMinutes: 15,
};

describe("course content hashes", () => {
  it("keeps identical course content stable", async () => {
    const first = await hashCourseContent(course);
    const second = await hashCourseContent({ ...course });
    const changed = await hashCourseContent({ ...course, summary: "新的摘要" });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("includes chapter position and access mode", async () => {
    const first = await hashChapterContent(chapter);
    const moved = await hashChapterContent({ ...chapter, position: 2 });
    const gated = await hashChapterContent({
      ...chapter,
      accessLevel: "member",
      previewMode: "summary_only",
    });

    expect(moved).not.toBe(first);
    expect(gated).not.toBe(first);
  });
});

describe("course publication state", () => {
  it("supports the shared publish and archive transitions", () => {
    expect(canPublishCourseContent("draft")).toBe(true);
    expect(canPublishCourseContent("pending_review")).toBe(true);
    expect(canPublishCourseContent("rejected")).toBe(true);
    expect(canPublishCourseContent("archived")).toBe(true);
    expect(canPublishCourseContent("published")).toBe(false);
    expect(canArchiveCourseContent("published")).toBe(true);
    expect(canArchiveCourseContent("draft")).toBe(false);
  });

  it("blocks chapter publishing inside archived or deleted courses", () => {
    expect(
      canPublishChapterWithinCourse({
        courseStatus: "published",
        courseDeleted: false,
      }),
    ).toBe(true);
    expect(
      canPublishChapterWithinCourse({
        courseStatus: "archived",
        courseDeleted: false,
      }),
    ).toBe(false);
    expect(
      canPublishChapterWithinCourse({
        courseStatus: "draft",
        courseDeleted: true,
      }),
    ).toBe(false);
  });
});
