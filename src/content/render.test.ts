import { describe, expect, it } from "vitest";

import { renderContentHtml } from "./render";
import { PAYWALL_MARKER } from "./types";

const memberBody = `<p>公开试读</p>${PAYWALL_MARKER}<p>会员分析</p>`;

describe("server-side content rendering", () => {
  it("returns all public content to every audience", () => {
    for (const audience of ["visitor", "member", "admin"] as const) {
      expect(
        renderContentHtml({
          bodyHtml: "<p>公开全文</p>",
          accessLevel: "public",
          previewMode: "none",
          audience,
        }),
      ).toEqual({
        html: "<p>公开全文</p>",
        hasFullAccess: true,
        isRestricted: false,
      });
    }
  });

  it("returns only the public segment to a visitor", () => {
    const rendered = renderContentHtml({
      bodyHtml: memberBody,
      accessLevel: "member",
      previewMode: "paywall_marker",
      audience: "visitor",
    });

    expect(rendered).toEqual({
      html: "<p>公开试读</p>",
      hasFullAccess: false,
      isRestricted: true,
    });
    expect(rendered.html).not.toContain("会员分析");
  });

  it("returns full member content without the marker to members and admins", () => {
    for (const audience of ["member", "admin"] as const) {
      const rendered = renderContentHtml({
        bodyHtml: memberBody,
        accessLevel: "member",
        previewMode: "paywall_marker",
        audience,
      });

      expect(rendered.html).toBe("<p>公开试读</p><p>会员分析</p>");
      expect(rendered.hasFullAccess).toBe(true);
      expect(rendered.isRestricted).toBe(false);
      expect(rendered.html).not.toContain(PAYWALL_MARKER);
    }
  });

  it("returns an empty body to visitors for summary-only member content", () => {
    expect(
      renderContentHtml({
        bodyHtml: "<p>会员正文</p>",
        accessLevel: "member",
        previewMode: "summary_only",
        audience: "visitor",
      }),
    ).toEqual({
      html: "",
      hasFullAccess: false,
      isRestricted: true,
    });
  });

  it("allows only administrators to read private content", () => {
    for (const audience of ["visitor", "member"] as const) {
      expect(
        renderContentHtml({
          bodyHtml: "<p>内部内容</p>",
          accessLevel: "private",
          previewMode: "none",
          audience,
        }),
      ).toEqual({
        html: "",
        hasFullAccess: false,
        isRestricted: true,
      });
    }

    expect(
      renderContentHtml({
        bodyHtml: "<p>内部内容</p>",
        accessLevel: "private",
        previewMode: "none",
        audience: "admin",
      }),
    ).toEqual({
      html: "<p>内部内容</p>",
      hasFullAccess: true,
      isRestricted: false,
    });
  });

  it("defensively strips stray paywall markers from full-access responses", () => {
    const rendered = renderContentHtml({
      bodyHtml: `<p>A</p>${PAYWALL_MARKER}<p>B</p>${PAYWALL_MARKER}`,
      accessLevel: "public",
      previewMode: "none",
      audience: "visitor",
    });

    expect(rendered.html).toBe("<p>A</p><p>B</p>");
  });
});
