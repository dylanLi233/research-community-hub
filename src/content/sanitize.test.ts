import { describe, expect, it } from "vitest";

import {
  hasMeaningfulSanitizedHtml,
  sanitizeHtmlSegment,
} from "./sanitize";

const assetId = "123e4567-e89b-42d3-a456-426614174000";

describe("HTML sanitizer", () => {
  it("preserves the supported long-form content elements", () => {
    const result = sanitizeHtmlSegment(`
      <h2>核心结论</h2>
      <p><strong>增长</strong>仍在继续，<em>波动</em>需要关注。</p>
      <ul><li>第一点</li></ul>
      <blockquote>引用</blockquote>
      <table><thead><tr><th scope="col">指标</th></tr></thead><tbody><tr><td colspan="2">数据</td></tr></tbody></table>
      <figure><img src="/media/${assetId}" alt="图表" loading="lazy"><figcaption>图一</figcaption></figure>
      <pre><code class="language-json">{"ok":true}</code></pre>
      <a href="https://example.com/report" title="来源">来源</a>
    `);

    expect(result.html).toContain("<h2>核心结论</h2>");
    expect(result.html).toContain(`<img src="/media/${assetId}"`);
    expect(result.html).toContain('scope="col"');
    expect(result.html).toContain('colspan="2"');
    expect(result.html).toContain('class="language-json"');
    expect(result.html).toContain('href="https://example.com/report"');
  });

  it("removes dangerous tags together with their bodies", () => {
    const result = sanitizeHtmlSegment(`
      <p>安全内容</p>
      <script>alert(1)</script>
      <style>body{display:none}</style>
      <iframe src="https://evil.example">secret</iframe>
      <svg><script>alert(2)</script><text>hidden</text></svg>
      <form><input value="token"><button>submit</button></form>
    `);

    expect(result.html).toBe("<p>安全内容</p>");
    expect(result.html).not.toContain("alert");
    expect(result.html).not.toContain("secret");
    expect(result.warnings.some((warning) => warning.code === "HTML_TAG_REMOVED")).toBe(
      true,
    );
  });

  it("removes event handlers, inline styles and unknown attributes", () => {
    const result = sanitizeHtmlSegment(
      '<p style="color:red" onclick="alert(1)" data-secret="x">正文</p>',
    );

    expect(result.html).toBe("<p>正文</p>");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HTML_ATTRIBUTE_REMOVED",
          tag: "p",
          attribute: "style",
        }),
        expect.objectContaining({
          code: "HTML_ATTRIBUTE_REMOVED",
          tag: "p",
          attribute: "onclick",
        }),
      ]),
    );
  });

  it("allows safe links and rejects dangerous or ambiguous link URLs", () => {
    const result = sanitizeHtmlSegment(`
      <a href="/reports/example">internal</a>
      <a href="#section">anchor</a>
      <a href="mailto:reader@example.com">mail</a>
      <a href="javascript:alert(1)">js</a>
      <a href="data:text/html,hello">data</a>
      <a href="//evil.example/path">relative</a>
      <a href="jav&#x61;script:alert(1)">encoded</a>
    `);

    expect(result.html).toContain('href="/reports/example"');
    expect(result.html).toContain('href="#section"');
    expect(result.html).toContain('href="mailto:reader@example.com"');
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("data:text");
    expect(result.html).not.toContain("//evil.example");
    expect(result.html).not.toContain("jav&#x61;script");
    expect(
      result.warnings.some((warning) => warning.code === "HTML_URL_REMOVED"),
    ).toBe(true);
  });

  it("allows only the controlled media route for image sources", () => {
    const result = sanitizeHtmlSegment(`
      <img src="/media/${assetId}" alt="allowed">
      <img src="https://cdn.example.com/chart.png" alt="external">
      <img src="data:image/png;base64,AAAA" alt="data">
      <img src="/media/not-a-uuid" alt="invalid">
    `);

    expect(result.html).toContain(`/media/${assetId}`);
    expect(result.html).not.toContain("cdn.example.com");
    expect(result.html).not.toContain("data:image");
    expect(result.html).not.toContain("not-a-uuid");
  });

  it("removes invalid numeric and enumerated attributes", () => {
    const result = sanitizeHtmlSegment(
      `<img src="/media/${assetId}" width="99999" height="100" loading="auto"><table><tr><th colspan="99" scope="bad">x</th></tr></table><code class="not-language">x</code>`,
    );

    expect(result.html).toContain('height="100"');
    expect(result.html).not.toContain("99999");
    expect(result.html).not.toContain('loading="auto"');
    expect(result.html).not.toContain('colspan="99"');
    expect(result.html).not.toContain('scope="bad"');
    expect(result.html).not.toContain("not-language");
  });

  it("detects empty and meaningful sanitized content", () => {
    expect(hasMeaningfulSanitizedHtml("<p> </p>")).toBe(false);
    expect(hasMeaningfulSanitizedHtml("<p>内容</p>")).toBe(true);
    expect(hasMeaningfulSanitizedHtml(`<img src="/media/${assetId}">`)).toBe(
      true,
    );
  });
});
