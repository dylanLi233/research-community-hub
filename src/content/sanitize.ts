import {
  escapeAttrValue,
  filterXSSWithResult,
  type IFilterXSSOptions,
} from "xss";

import type { HtmlSanitizeWarning } from "./types";

const ALLOWED_HTML: NonNullable<IFilterXSSOptions["whiteList"]> = {
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  p: [],
  strong: [],
  em: [],
  ul: [],
  ol: [],
  li: [],
  blockquote: [],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  figure: [],
  figcaption: [],
  img: ["src", "alt", "title", "width", "height", "loading"],
  a: ["href", "title"],
  hr: [],
  code: ["class"],
  pre: [],
};

const STRIP_TAG_BODIES = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "template",
];

const MEDIA_URL_PATTERN =
  /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_URL_CHARACTER_PATTERN = /[\u0000-\u0020\u007f\\]/;
const ENCODED_URL_TOKEN_PATTERN = /&(?:#x?[0-9a-f]+|[a-z][a-z0-9]+);/i;

function warningKey(warning: HtmlSanitizeWarning): string {
  return `${warning.code}:${warning.tag ?? ""}:${warning.attribute ?? ""}`;
}

function deduplicateWarnings(
  warnings: HtmlSanitizeWarning[],
): HtmlSanitizeWarning[] {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = warningKey(warning);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isSafeLinkUrl(value: string): boolean {
  const normalized = value.trim();

  if (
    !normalized ||
    UNSAFE_URL_CHARACTER_PATTERN.test(normalized) ||
    ENCODED_URL_TOKEN_PATTERN.test(normalized)
  ) {
    return false;
  }

  if (normalized.startsWith("#")) {
    return true;
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(normalized);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return true;
    }

    return (
      url.protocol === "mailto:" &&
      !normalized.includes("?") &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized.slice("mailto:".length))
    );
  } catch {
    return false;
  }
}

function safePositiveInteger(value: string, max: number): string | null {
  if (!/^\d{1,5}$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? String(parsed) : null;
}

export type SanitizedHtml = {
  html: string;
  warnings: HtmlSanitizeWarning[];
};

export function sanitizeHtmlSegment(rawHtml: string): SanitizedHtml {
  const warnings: HtmlSanitizeWarning[] = [];
  const result = filterXSSWithResult(rawHtml, {
    whiteList: ALLOWED_HTML,
    stripIgnoreTag: true,
    stripIgnoreTagBody: STRIP_TAG_BODIES,
    allowCommentTag: false,
    css: false,
    onIgnoreTag(tag) {
      warnings.push({ code: "HTML_TAG_REMOVED", tag });
      return "";
    },
    onIgnoreTagAttr(tag, attribute) {
      warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
      return "";
    },
    onTagAttr(tag, attribute, value, isWhiteAttr) {
      if (!isWhiteAttr) {
        warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
        return "";
      }

      if (tag === "a" && attribute === "href") {
        if (!isSafeLinkUrl(value)) {
          warnings.push({ code: "HTML_URL_REMOVED", tag, attribute });
          return "";
        }

        return `href="${escapeAttrValue(value.trim())}"`;
      }

      if (tag === "img" && attribute === "src") {
        const normalized = value.trim();

        if (!MEDIA_URL_PATTERN.test(normalized)) {
          warnings.push({ code: "HTML_URL_REMOVED", tag, attribute });
          return "";
        }

        return `src="${escapeAttrValue(normalized)}"`;
      }

      if (
        (tag === "img" && (attribute === "width" || attribute === "height")) ||
        ((tag === "th" || tag === "td") &&
          (attribute === "colspan" || attribute === "rowspan"))
      ) {
        const limit = tag === "img" ? 4096 : 20;
        const safeValue = safePositiveInteger(value, limit);

        if (!safeValue) {
          warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
          return "";
        }

        return `${attribute}="${safeValue}"`;
      }

      if (tag === "img" && attribute === "loading") {
        if (value !== "lazy" && value !== "eager") {
          warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
          return "";
        }

        return `loading="${value}"`;
      }

      if (tag === "th" && attribute === "scope") {
        if (!["row", "col", "rowgroup", "colgroup"].includes(value)) {
          warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
          return "";
        }

        return `scope="${value}"`;
      }

      if (tag === "code" && attribute === "class") {
        if (!/^language-[a-z0-9_-]{1,30}$/i.test(value)) {
          warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
          return "";
        }

        return `class="${escapeAttrValue(value)}"`;
      }

      return undefined;
    },
  });

  for (const removed of result.removed) {
    if (removed.type === "tag") {
      warnings.push({ code: "HTML_TAG_REMOVED", tag: removed.tag });
    } else {
      warnings.push({
        code:
          removed.attr === "href" || removed.attr === "src"
            ? "HTML_URL_REMOVED"
            : "HTML_ATTRIBUTE_REMOVED",
        tag: removed.tag,
        attribute: removed.attr,
      });
    }
  }

  return {
    html: result.html.trim(),
    warnings: deduplicateWarnings(warnings),
  };
}

export function hasMeaningfulSanitizedHtml(html: string): boolean {
  if (!html.trim()) {
    return false;
  }

  if (/<(?:img|table|hr)\b/i.test(html)) {
    return true;
  }

  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, " ")
    .replace(/\s+/g, "")
    .trim();

  return text.length > 0;
}
