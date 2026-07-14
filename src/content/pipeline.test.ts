import { describe, expect, it } from "vitest";

import { prepareContentHtml } from "./pipeline";
import {
  ContentHtmlError,
  MAX_CONTENT_HTML_CHARS,
  PAYWALL_MARKER,
} from "./types";

function expectContentError(
  callback: () => unknown,
  code: string,
): void {
  try {
    callback();
    throw new Error("Expected content preparation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ContentHtmlError);
    expect(error).toMatchObject({ code });
  }
}

describe("content HTML preparation", () => {
  it("prepares public and private content without a paywall marker", () => {
    const publicResult = prepareContentHtml({
      rawHtml: "<h2>公开</h2><p>全文</p>",
      accessLevel: "public",
      previewMode: "none",
    });
    const privateResult = prepareContentHtml({
      rawHtml: "<p>内部内容</p>",
      accessLevel: "private",
      previewMode: "none",
    });

    expect(publicResult.bodyHtml).toBe("<h2>公开</h2><p>全文</p>");
    expect(privateResult.bodyHtml).toBe("<p>内部内容</p>");
  });

  it("sanitizes public and member segments separately and preserves one marker", () => {
    const result = prepareContentHtml({
      rawHtml: `<p onclick="bad()">试读</p>${PAYWALL_MARKER}<script>secret()</script><p>完整分析</p>`,
      accessLevel: "member",
      previewMode: "paywall_marker",
    });

    expect(result.bodyHtml).toBe(
      `<p>试读</p>${PAYWALL_MARKER}<p>完整分析</p>`,
    );
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("requires exactly one marker for paywall preview mode", () => {
    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: "<p>没有付费墙</p>",
          accessLevel: "member",
          previewMode: "paywall_marker",
        }),
      "PAYWALL_MARKER_REQUIRED",
    );

    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: `<p>A</p>${PAYWALL_MARKER}<p>B</p>${PAYWALL_MARKER}<p>C</p>`,
          accessLevel: "member",
          previewMode: "paywall_marker",
        }),
      "MULTIPLE_PAYWALL_MARKERS",
    );
  });

  it("requires meaningful content on both sides of the marker", () => {
    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: `<script>bad()</script>${PAYWALL_MARKER}<p>会员正文</p>`,
          accessLevel: "member",
          previewMode: "paywall_marker",
        }),
      "EMPTY_PUBLIC_PREVIEW_AFTER_SANITIZE",
    );

    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: `<p>试读</p>${PAYWALL_MARKER}<style>hidden</style>`,
          accessLevel: "member",
          previewMode: "paywall_marker",
        }),
      "EMPTY_MEMBER_BODY_AFTER_SANITIZE",
    );
  });

  it("supports summary-only member content without exposing a marker", () => {
    const result = prepareContentHtml({
      rawHtml: "<h2>会员正文</h2><p>完整内容</p>",
      accessLevel: "member",
      previewMode: "summary_only",
    });

    expect(result.bodyHtml).toBe("<h2>会员正文</h2><p>完整内容</p>");
  });

  it("rejects markers in none and summary-only modes", () => {
    for (const input of [
      { accessLevel: "public" as const, previewMode: "none" as const },
      { accessLevel: "private" as const, previewMode: "none" as const },
      { accessLevel: "member" as const, previewMode: "summary_only" as const },
    ]) {
      expectContentError(
        () =>
          prepareContentHtml({
            rawHtml: `<p>A</p>${PAYWALL_MARKER}<p>B</p>`,
            ...input,
          }),
        "PAYWALL_MARKER_NOT_ALLOWED",
      );
    }
  });

  it("rejects invalid access and preview mode combinations", () => {
    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: "<p>正文</p>",
          accessLevel: "member",
          previewMode: "none",
        }),
      "INVALID_PREVIEW_MODE",
    );

    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: "<p>正文</p>",
          accessLevel: "public",
          previewMode: "summary_only",
        }),
      "INVALID_PREVIEW_MODE",
    );
  });

  it("rejects empty, sanitized-empty and oversized bodies", () => {
    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: "   ",
          accessLevel: "public",
          previewMode: "none",
        }),
      "BODY_REQUIRED",
    );

    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: "<script>alert(1)</script>",
          accessLevel: "public",
          previewMode: "none",
        }),
      "EMPTY_BODY_AFTER_SANITIZE",
    );

    expectContentError(
      () =>
        prepareContentHtml({
          rawHtml: `<p>${"x".repeat(MAX_CONTENT_HTML_CHARS)}</p>`,
          accessLevel: "public",
          previewMode: "none",
        }),
      "BODY_TOO_LARGE",
    );
  });
});
