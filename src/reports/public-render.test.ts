import { describe, expect, it } from "vitest";

import { renderContentHtml } from "@/content/render";
import { PAYWALL_MARKER } from "@/content/types";

const memberBody = `<p>公开试读</p>${PAYWALL_MARKER}<h2>会员秘密结论</h2><p>仅会员可见的数据。</p>`;

describe("public report response boundary", () => {
  it("does not include post-paywall HTML for visitors", () => {
    const rendered = renderContentHtml({
      bodyHtml: memberBody,
      accessLevel: "member",
      previewMode: "paywall_marker",
      audience: "visitor",
    });
    const serializedPagePayload = JSON.stringify({
      report: {
        title: "会员研报",
        summary: "公开摘要",
        renderedHtml: rendered.html,
      },
    });

    expect(rendered.html).toBe("<p>公开试读</p>");
    expect(serializedPagePayload).not.toContain("会员秘密结论");
    expect(serializedPagePayload).not.toContain("仅会员可见的数据");
  });

  it("returns no body HTML for summary-only visitors", () => {
    const rendered = renderContentHtml({
      bodyHtml: "<h2>完整会员正文</h2>",
      accessLevel: "member",
      previewMode: "summary_only",
      audience: "visitor",
    });

    expect(rendered.html).toBe("");
    expect(rendered.isRestricted).toBe(true);
  });

  it("returns complete HTML to active members and administrators", () => {
    for (const audience of ["member", "admin"] as const) {
      const rendered = renderContentHtml({
        bodyHtml: memberBody,
        accessLevel: "member",
        previewMode: "paywall_marker",
        audience,
      });

      expect(rendered.html).toContain("会员秘密结论");
      expect(rendered.html).not.toContain(PAYWALL_MARKER);
      expect(rendered.hasFullAccess).toBe(true);
    }
  });
});
