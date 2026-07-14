import { describe, expect, it } from "vitest";

import {
  ContentHtmlError,
  PAYWALL_MARKER,
  processContentHtml,
  projectVisibleContentHtml,
  sanitizeContentHtml,
} from "./html";

const assetId = "123e4567-e89b-42d3-a456-426614174000";

describe("HTML sanitization", () => {
  it("keeps the explicit article allowlist and removes presentation attributes", () => {
    const result = sanitizeContentHtml(
      '<h2 id="title" class="hero">标题</h2><p style="color:red">正文 <strong>重点</strong></p>',
    );

    expect(result.html).toBe("<h2>标题</h2><p>正文 <strong>重点</strong></p>");
    expect(result.changed).toBe(true);
  });

  it("removes executable and form content instead of preserving its text", () => {
    const result = sanitizeContentHtml(
      '<p>安全</p><script>alert(1)</script><style>body{display:none}</style><form><input value="secret"><button>提交</button></form>',
    );

    expect(result.html).toBe("<p>安全</p>");
    expect(result.html).not.toContain("alert");
    expect(result.html).not.toContain("secret");
    expect(result.html).not.toContain("提交");
  });

  it("unwraps unknown harmless elements while preserving safe text", () => {
    const result = sanitizeContentHtml("<custom-box><p>保留文字</p></custom-box>");
    expect(result.html).toBe("<p>保留文字</p>");
  });

  it("removes event handlers and dangerous link protocols", () => {
    const result = sanitizeContentHtml(
      '<p onclick="steal()"><a href="javascript:alert(1)" onmouseover="steal()">危险链接</a></p>',
    );

    expect(result.html).toBe("<p><a>危险链接</a></p>");
  });

  it("keeps internal links and hardens HTTP and HTTPS external links", () => {
    const result = sanitizeContentHtml(
      '<p><a href="/reports/example">站内</a> <a href="https://example.com/path">站外</a> <a href="mailto:test@example.com">邮件</a></p>',
    );

    expect(result.html).toContain('<a href="/reports/example">站内</a>');
    expect(result.html).toContain(
      '<a href="https://example.com/path" rel="noopener noreferrer">站外</a>',
    );
    expect(result.html).toContain("<a>邮件</a>");
  });

  it("only keeps images that point to a valid internal asset UUID", () => {
    const result = sanitizeContentHtml(
      `<figure><img src="/assets/${assetId}" alt="图表" width="1200" height="800" onerror="steal()"><figcaption>说明</figcaption></figure><img src="https://evil.example/x.png"><img src="data:image/png;base64,AAAA">`,
    );

    expect(result.html).toBe(
      `<figure><img src="/assets/${assetId}" alt="图表" width="1200" height="800"><figcaption>说明</figcaption></figure>`,
    );
  });

  it("removes invalid image dimensions and unsafe table spans", () => {
    const result = sanitizeContentHtml(
      `<img src="/assets/${assetId}" width="0" height="999999"><table><tbody><tr><td colspan="2" rowspan="0">数据</td></tr></tbody></table>`,
    );

    expect(result.html).toContain(`<img src="/assets/${assetId}">`);
    expect(result.html).toContain('<td colspan="2">数据</td>');
    expect(result.html).not.toContain("rowspan");
  });
});

describe("paywall validation", () => {
  it("rejects a paywall marker in public content", () => {
    expect(() =>
      processContentHtml({
        bodyHtml: `<p>公开</p>${PAYWALL_MARKER}<p>隐藏</p>`,
        accessLevel: "public",
        previewMode: "paywall_marker",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "PAYWALL_MARKER_NOT_ALLOWED" }),
    );
  });

  it("requires exactly one marker for member preview content", () => {
    expect(() =>
      processContentHtml({
        bodyHtml: "<p>没有标记</p>",
        accessLevel: "member",
        previewMode: "paywall_marker",
      }),
    ).toThrowError(expect.objectContaining({ code: "PAYWALL_MARKER_REQUIRED" }));

    expect(() =>
      processContentHtml({
        bodyHtml: `<p>公开</p>${PAYWALL_MARKER}<p>会员一</p>${PAYWALL_MARKER}<p>会员二</p>`,
        accessLevel: "member",
        previewMode: "paywall_marker",
      }),
    ).toThrowError(expect.objectContaining({ code: "MULTIPLE_PAYWALL_MARKERS" }));
  });

  it("requires meaningful content on both sides of the marker", () => {
    expect(() =>
      processContentHtml({
        bodyHtml: `<script>bad()</script>${PAYWALL_MARKER}<p>会员</p>`,
        accessLevel: "member",
        previewMode: "paywall_marker",
      }),
    ).toThrowError(expect.objectContaining({ code: "EMPTY_PUBLIC_PREVIEW" }));

    expect(() =>
      processContentHtml({
        bodyHtml: `<p>公开</p>${PAYWALL_MARKER}<iframe src="https://evil.example"></iframe>`,
        accessLevel: "member",
        previewMode: "paywall_marker",
      }),
    ).toThrowError(expect.objectContaining({ code: "EMPTY_MEMBER_BODY" }));
  });

  it("rejects content that becomes empty after sanitization", () => {
    expect(() =>
      processContentHtml({
        bodyHtml: "<script>alert(1)</script>",
        accessLevel: "public",
        previewMode: "summary_only",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "EMPTY_BODY_AFTER_SANITIZE" }),
    );
  });

  it("returns a warning when sanitization changes submitted HTML", () => {
    const result = processContentHtml({
      bodyHtml: '<p onclick="bad()">正文</p>',
      accessLevel: "public",
      previewMode: "summary_only",
    });

    expect(result.bodyHtml).toBe("<p>正文</p>");
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "HTML_SANITIZED", field: "body_html" }),
    ]);
  });

  it("stores one sanitized body with the exact marker", () => {
    const result = processContentHtml({
      bodyHtml: `<h2>公开</h2><p>试读</p>${PAYWALL_MARKER}<h2>会员</h2><p>完整分析</p>`,
      accessLevel: "member",
      previewMode: "paywall_marker",
    });

    expect(result.bodyHtml.split(PAYWALL_MARKER)).toHaveLength(2);
    expect(result.bodyHtml).toContain("完整分析");
  });
});

describe("server-side content projection", () => {
  const memberContent = processContentHtml({
    bodyHtml: `<p>公开试读</p>${PAYWALL_MARKER}<p>绝密会员逻辑</p>`,
    accessLevel: "member",
    previewMode: "paywall_marker",
  });

  it("only returns the preview to visitors and expired members", () => {
    const visitor = projectVisibleContentHtml(memberContent, {
      isAdmin: false,
      hasMemberAccess: false,
    });

    expect(visitor).toEqual({
      html: "<p>公开试读</p>",
      isComplete: false,
      paywalled: true,
    });
    expect(JSON.stringify(visitor)).not.toContain("绝密会员逻辑");
  });

  it("returns complete content to active members without the marker", () => {
    const member = projectVisibleContentHtml(memberContent, {
      isAdmin: false,
      hasMemberAccess: true,
    });

    expect(member.html).toBe("<p>公开试读</p><p>绝密会员逻辑</p>");
    expect(member.isComplete).toBe(true);
    expect(member.paywalled).toBe(false);
    expect(member.html).not.toContain(PAYWALL_MARKER);
  });

  it("returns no body for summary-only visitors", () => {
    const summaryOnly = processContentHtml({
      bodyHtml: "<p>完整会员正文</p>",
      accessLevel: "member",
      previewMode: "summary_only",
    });

    expect(
      projectVisibleContentHtml(summaryOnly, {
        isAdmin: false,
        hasMemberAccess: false,
      }),
    ).toEqual({ html: null, isComplete: false, paywalled: true });
  });

  it("keeps private content unavailable except to administrators", () => {
    const privateContent = processContentHtml({
      bodyHtml: "<p>管理员草稿</p>",
      accessLevel: "private",
      previewMode: "summary_only",
    });

    expect(
      projectVisibleContentHtml(privateContent, {
        isAdmin: false,
        hasMemberAccess: true,
      }).html,
    ).toBeNull();
    expect(
      projectVisibleContentHtml(privateContent, {
        isAdmin: true,
        hasMemberAccess: false,
      }).html,
    ).toBe("<p>管理员草稿</p>");
  });

  it("fails closed for corrupted stored member content", () => {
    const corrupted = {
      bodyHtml: "<p>公开</p><p>意外泄漏</p>",
      accessLevel: "member" as const,
      previewMode: "paywall_marker" as const,
    };

    expect(
      projectVisibleContentHtml(corrupted, {
        isAdmin: false,
        hasMemberAccess: false,
      }),
    ).toEqual({ html: null, isComplete: false, paywalled: true });
    expect(
      projectVisibleContentHtml(corrupted, {
        isAdmin: false,
        hasMemberAccess: true,
      }),
    ).toEqual({ html: null, isComplete: false, paywalled: true });
  });

  it("uses typed content errors", () => {
    try {
      processContentHtml({
        bodyHtml: "<script>bad()</script>",
        accessLevel: "public",
        previewMode: "summary_only",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ContentHtmlError);
      expect((error as ContentHtmlError).field).toBe("body_html");
    }
  });
});
