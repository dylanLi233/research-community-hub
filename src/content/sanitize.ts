import xss, {
  escapeAttrValue,
  parseTag,
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

const ALLOWED_TAG_NAMES = new Set(Object.keys(ALLOWED_HTML));
const DANGEROUS_CONTAINER_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "form",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "template",
]);
const DANGEROUS_VOID_TAGS = new Set(["embed", "input"]);
const DANGEROUS_TAGS = new Set([
  ...DANGEROUS_CONTAINER_TAGS,
  ...DANGEROUS_VOID_TAGS,
]);

const MEDIA_URL_PATTERN =
  /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_URL_CHARACTER_PATTERN = /[\u0000-\u0020\u007f\\]/;
const ENCODED_URL_TOKEN_PATTERN = /&(?:#x?[0-9a-f]+|[a-z][a-z0-9]+);/i;

type HtmlRange = {
  start: number;
  end: number;
};

type DangerousTagFrame = {
  tag: string;
  start: number;
};

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

function mergeRanges(ranges: HtmlRange[]): HtmlRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: HtmlRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);

    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

function removeRanges(rawHtml: string, ranges: HtmlRange[]): string {
  const merged = mergeRanges(ranges);
  let cursor = 0;
  let output = "";

  for (const range of merged) {
    output += rawHtml.slice(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }

  return output + rawHtml.slice(cursor);
}

function stripDangerousTagBodies(
  rawHtml: string,
  warnings: HtmlSanitizeWarning[],
): string {
  const ranges: HtmlRange[] = [];
  const stack: DangerousTagFrame[] = [];

  parseTag(
    rawHtml,
    (sourcePosition, _position, tag, tagHtml, isClosing) => {
      const normalizedTag = tag.toLowerCase();

      if (normalizedTag && !ALLOWED_TAG_NAMES.has(normalizedTag)) {
        warnings.push({ code: "HTML_TAG_REMOVED", tag: normalizedTag });
      }

      if (!DANGEROUS_TAGS.has(normalizedTag)) {
        return tagHtml;
      }

      const tagEnd = sourcePosition + tagHtml.length;
      const isSelfClosing =
        DANGEROUS_VOID_TAGS.has(normalizedTag) || /\/\s*>$/.test(tagHtml);

      if (!isClosing) {
        if (isSelfClosing) {
          ranges.push({ start: sourcePosition, end: tagEnd });
        } else {
          stack.push({ tag: normalizedTag, start: sourcePosition });
        }

        return tagHtml;
      }

      let matchingIndex = -1;

      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index]?.tag === normalizedTag) {
          matchingIndex = index;
          break;
        }
      }

      if (matchingIndex === -1) {
        ranges.push({ start: sourcePosition, end: tagEnd });
        return tagHtml;
      }

      const start = stack[matchingIndex]?.start ?? sourcePosition;
      stack.splice(matchingIndex);
      ranges.push({ start, end: tagEnd });
      return tagHtml;
    },
    (value) => value,
  );

  for (const unclosedTag of stack) {
    ranges.push({ start: unclosedTag.start, end: rawHtml.length });
  }

  return removeRanges(rawHtml, ranges);
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
  const bodySafeHtml = stripDangerousTagBodies(rawHtml, warnings);
  const html = xss(bodySafeHtml, {
    whiteList: ALLOWED_HTML,
    stripIgnoreTag: true,
    allowCommentTag: false,
    css: false,
    onIgnoreTagAttr(tag: string, attribute: string) {
      warnings.push({ code: "HTML_ATTRIBUTE_REMOVED", tag, attribute });
      return "";
    },
    onTagAttr(
      tag: string,
      attribute: string,
      value: string,
      isWhiteAttr: boolean,
    ) {
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

  return {
    html: html.trim(),
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
