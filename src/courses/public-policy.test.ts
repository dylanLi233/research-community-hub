import { describe, expect, it } from "vitest";

import {
  isPublicChapterRecordVisible,
  isPublicCourseRecordVisible,
  orderCourseChapters,
  projectChapterForAudience,
} from "./public-policy";
import { PAYWALL_MARKER } from "@/content/types";

const now = new Date("2026-07-15T00:00:00.000Z");

describe("public course visibility", () => {
  const visible = {
    status: "published" as const,
    accessLevel: "member" as const,
    publishedAt: new Date("2026-07-14T00:00:00.000Z"),
    deletedAt: null,
  };

  it("shows published public or member content after publication", () => {
    expect(isPublicCourseRecordVisible(visible, now)).toBe(true);
    expect(
      isPublicChapterRecordVisible(
        { ...visible, accessLevel: "public" },
        now,
      ),
    ).toBe(true);
  });

  it("hides private, non-published, deleted, missing-date and future content", () => {
    expect(
      isPublicCourseRecordVisible({ ...visible, accessLevel: "private" }, now),
    ).toBe(false);
    expect(
      isPublicCourseRecordVisible({ ...visible, status: "draft" }, now),
    ).toBe(false);
    expect(
      isPublicCourseRecordVisible({ ...visible, status: "archived" }, now),
    ).toBe(false);
    expect(
      isPublicCourseRecordVisible({ ...visible, deletedAt: new Date() }, now),
    ).toBe(false);
    expect(
      isPublicCourseRecordVisible({ ...visible, publishedAt: null }, now),
    ).toBe(false);
    expect(
      isPublicCourseRecordVisible(
        { ...visible, publishedAt: new Date("2026-07-16T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });
});

describe("course chapter ordering", () => {
  it("sorts by position, creation time, title and id", () => {
    const ordered = orderCourseChapters([
      {
        id: "c",
        position: 2,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        title: "第三章",
      },
      {
        id: "b",
        position: 1,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        title: "第二章",
      },
      {
        id: "a",
        position: 1,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        title: "第一章",
      },
    ]);

    expect(ordered.map((chapter) => chapter.id)).toEqual(["a", "b", "c"]);
  });
});

describe("chapter audience projection", () => {
  const memberChapter = {
    id: "chapter-id",
    courseId: "course-id",
    title: "会员章节",
    slug: "member-chapter",
    summary: "章节摘要",
    bodyHtml: `<p>公开试读</p>${PAYWALL_MARKER}<p>绝不能泄露的会员正文</p>`,
    accessLevel: "member" as const,
    previewMode: "paywall_marker" as const,
    position: 1,
    estimatedMinutes: 12,
  };

  it("removes paid HTML from the visitor projection", () => {
    const projected = projectChapterForAudience(memberChapter, "visitor");
    const serialized = JSON.stringify(projected);

    expect(projected.html).toBe("<p>公开试读</p>");
    expect(projected.isRestricted).toBe(true);
    expect(serialized).not.toContain("绝不能泄露的会员正文");
    expect(serialized).not.toContain(PAYWALL_MARKER);
    expect(serialized).not.toContain("bodyHtml");
  });

  it("returns the complete chapter to members and administrators", () => {
    for (const audience of ["member", "admin"] as const) {
      const projected = projectChapterForAudience(memberChapter, audience);

      expect(projected.html).toBe(
        "<p>公开试读</p><p>绝不能泄露的会员正文</p>",
      );
      expect(projected.hasFullAccess).toBe(true);
      expect(projected.isRestricted).toBe(false);
    }
  });

  it("returns no body for summary-only visitors", () => {
    const projected = projectChapterForAudience(
      {
        ...memberChapter,
        bodyHtml: "<p>完整会员正文</p>",
        previewMode: "summary_only",
      },
      "visitor",
    );

    expect(projected.html).toBe("");
    expect(JSON.stringify(projected)).not.toContain("完整会员正文");
  });

  it("returns public chapters to everyone", () => {
    const projected = projectChapterForAudience(
      {
        ...memberChapter,
        bodyHtml: "<p>公开课程</p>",
        accessLevel: "public",
        previewMode: "none",
      },
      "visitor",
    );

    expect(projected.html).toBe("<p>公开课程</p>");
    expect(projected.hasFullAccess).toBe(true);
  });
});
