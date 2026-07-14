import type { Element, Root, RootContent } from "hast";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

export const PAYWALL_MARKER = "<!-- PAYWALL -->";

export type ContentAccessLevel = "public" | "member" | "private";
export type ContentPreviewMode = "paywall_marker" | "summary_only";

export type ContentHtmlWarning = {
  code: "HTML_SANITIZED";
  field: "body_html";
  message: string;
};

export type ProcessedContentHtml = {
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
  warnings: ContentHtmlWarning[];
};

export type ContentViewer = {
  isAdmin: boolean;
  hasMemberAccess: boolean;
};

export type VisibleContentHtml = {
  html: string | null;
  isComplete: boolean;
  paywalled: boolean;
};

export class ContentHtmlError extends Error {
  constructor(
    public readonly code:
      | "PAYWALL_MARKER_NOT_ALLOWED"
      | "PAYWALL_MARKER_REQUIRED"
      | "MULTIPLE_PAYWALL_MARKERS"
      | "EMPTY_BODY_AFTER_SANITIZE"
      | "EMPTY_PUBLIC_PREVIEW"
      | "EMPTY_MEMBER_BODY",
    message: string,
    public readonly field = "body_html",
    public readonly status = 422,
  ) {
    super(message);
    this.name = "ContentHtmlError";
  }
}

const allowedTags = [
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "strong",
  "em",
  "del",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "img",
  "a",
];

const sanitizeSchema = {
  tagNames: allowedTags,
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["colSpan", "rowSpan"],
    td: ["colSpan", "rowSpan"],
  },
  protocols: {
    href: ["http", "https"],
  },
  strip: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "link",
    "meta",
    "base",
    "svg",
    "math",
  ],
  clobberPrefix: "rch-",
};

const assetPathPattern =
  /^\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isSafeLink(value: string): { safe: boolean; external: boolean } {
  const href = value.trim();

  if (!href) {
    return { safe: false, external: false };
  }

  if (href.startsWith("#")) {
    return { safe: true, external: false };
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return { safe: true, external: false };
  }

  try {
    const url = new URL(href);
    return {
      safe: url.protocol === "http:" || url.protocol === "https:",
      external: true,
    };
  } catch {
    return { safe: false, external: false };
  }
}

function normalizePositiveInteger(
  value: unknown,
  maximum: number,
): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 && value <= maximum
      ? value
      : null;
  }

  if (typeof value === "string" && /^\d+$/u.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 && number <= maximum
      ? number
      : null;
  }

  return null;
}

function hardenSanitizedTree() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName === "img") {
        const src = typeof node.properties.src === "string" ? node.properties.src : "";

        if (!assetPathPattern.test(src)) {
          if (parent && typeof index === "number") {
            parent.children.splice(index, 1);
            return [SKIP, index];
          }
          return SKIP;
        }

        const width = normalizePositiveInteger(node.properties.width, 20_000);
        const height = normalizePositiveInteger(node.properties.height, 20_000);

        if (width === null) {
          delete node.properties.width;
        } else {
          node.properties.width = width;
        }

        if (height === null) {
          delete node.properties.height;
        } else {
          node.properties.height = height;
        }
      }

      if (node.tagName === "a") {
        const href =
          typeof node.properties.href === "string" ? node.properties.href : "";
        const decision = isSafeLink(href);

        if (!decision.safe) {
          delete node.properties.href;
          delete node.properties.rel;
        } else {
          node.properties.href = href.trim();
          if (decision.external) {
            node.properties.rel = ["noopener", "noreferrer"];
          }
        }
      }

      if (node.tagName === "th" || node.tagName === "td") {
        const colSpan = normalizePositiveInteger(node.properties.colSpan, 100);
        const rowSpan = normalizePositiveInteger(node.properties.rowSpan, 100);

        if (colSpan === null) {
          delete node.properties.colSpan;
        } else {
          node.properties.colSpan = colSpan;
        }

        if (rowSpan === null) {
          delete node.properties.rowSpan;
        } else {
          node.properties.rowSpan = rowSpan;
        }
      }
    });
  };
}

const canonicalProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeStringify);

const sanitizeProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, sanitizeSchema)
  .use(hardenSanitizedTree)
  .use(rehypeStringify);

function canonicalizeHtml(html: string): string {
  return canonicalProcessor.processSync(html).toString();
}

export function sanitizeContentHtml(html: string): {
  html: string;
  changed: boolean;
} {
  const canonicalOriginal = canonicalizeHtml(html);
  const sanitized = sanitizeProcessor.processSync(html).toString();

  return {
    html: sanitized,
    changed: canonicalOriginal !== sanitized,
  };
}

function hasMeaningfulContent(html: string): boolean {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Root;
  let meaningful = false;

  visit(tree, (node: RootContent) => {
    if (meaningful) {
      return SKIP;
    }

    if (node.type === "text" && node.value.replace(/\u00a0/gu, " ").trim()) {
      meaningful = true;
      return SKIP;
    }

    if (node.type === "element" && node.tagName === "img") {
      meaningful = true;
      return SKIP;
    }
  });

  return meaningful;
}

function markerCount(html: string): number {
  return html.split(PAYWALL_MARKER).length - 1;
}

function sanitizationWarning(changed: boolean): ContentHtmlWarning[] {
  return changed
    ? [
        {
          code: "HTML_SANITIZED",
          field: "body_html",
          message: "正文包含被移除或规范化的 HTML 内容",
        },
      ]
    : [];
}

export function processContentHtml(input: {
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
}): ProcessedContentHtml {
  const count = markerCount(input.bodyHtml);

  if (input.accessLevel === "member" && input.previewMode === "paywall_marker") {
    if (count === 0) {
      throw new ContentHtmlError(
        "PAYWALL_MARKER_REQUIRED",
        `会员试读正文必须包含一个 ${PAYWALL_MARKER}`,
      );
    }

    if (count > 1) {
      throw new ContentHtmlError(
        "MULTIPLE_PAYWALL_MARKERS",
        `会员试读正文只能包含一个 ${PAYWALL_MARKER}`,
      );
    }

    const [rawPublicHtml, rawMemberHtml] = input.bodyHtml.split(PAYWALL_MARKER);
    const publicResult = sanitizeContentHtml(rawPublicHtml);
    const memberResult = sanitizeContentHtml(rawMemberHtml);

    if (!hasMeaningfulContent(publicResult.html)) {
      throw new ContentHtmlError(
        "EMPTY_PUBLIC_PREVIEW",
        "付费墙之前必须包含有效的公开试读内容",
      );
    }

    if (!hasMeaningfulContent(memberResult.html)) {
      throw new ContentHtmlError(
        "EMPTY_MEMBER_BODY",
        "付费墙之后必须包含有效的会员正文",
      );
    }

    return {
      bodyHtml: `${publicResult.html}${PAYWALL_MARKER}${memberResult.html}`,
      accessLevel: input.accessLevel,
      previewMode: input.previewMode,
      warnings: sanitizationWarning(publicResult.changed || memberResult.changed),
    };
  }

  if (count > 0) {
    throw new ContentHtmlError(
      "PAYWALL_MARKER_NOT_ALLOWED",
      "当前访问级别或预览模式不允许付费墙标记",
    );
  }

  const result = sanitizeContentHtml(input.bodyHtml);

  if (!hasMeaningfulContent(result.html)) {
    throw new ContentHtmlError(
      "EMPTY_BODY_AFTER_SANITIZE",
      "正文清洗后没有可发布内容",
    );
  }

  return {
    bodyHtml: result.html,
    accessLevel: input.accessLevel,
    previewMode: input.previewMode,
    warnings: sanitizationWarning(result.changed),
  };
}

export function projectVisibleContentHtml(
  content: Pick<ProcessedContentHtml, "bodyHtml" | "accessLevel" | "previewMode">,
  viewer: ContentViewer,
): VisibleContentHtml {
  if (content.accessLevel === "private") {
    return viewer.isAdmin
      ? { html: content.bodyHtml, isComplete: true, paywalled: false }
      : { html: null, isComplete: false, paywalled: false };
  }

  if (content.accessLevel === "public") {
    return { html: content.bodyHtml, isComplete: true, paywalled: false };
  }

  if (viewer.isAdmin || viewer.hasMemberAccess) {
    if (content.previewMode === "paywall_marker") {
      const parts = content.bodyHtml.split(PAYWALL_MARKER);
      if (parts.length !== 2) {
        return viewer.isAdmin
          ? { html: content.bodyHtml, isComplete: true, paywalled: false }
          : { html: null, isComplete: false, paywalled: true };
      }
      return {
        html: `${parts[0]}${parts[1]}`,
        isComplete: true,
        paywalled: false,
      };
    }

    return { html: content.bodyHtml, isComplete: true, paywalled: false };
  }

  if (content.previewMode === "summary_only") {
    return { html: null, isComplete: false, paywalled: true };
  }

  const parts = content.bodyHtml.split(PAYWALL_MARKER);

  if (parts.length !== 2 || !hasMeaningfulContent(parts[0])) {
    return { html: null, isComplete: false, paywalled: true };
  }

  return { html: parts[0], isComplete: false, paywalled: true };
}
