import {
  hasMeaningfulSanitizedHtml,
  sanitizeHtmlSegment,
} from "./sanitize";
import {
  ContentHtmlError,
  MAX_CONTENT_HTML_CHARS,
  PAYWALL_MARKER,
  type ContentAccessLevel,
  type ContentPreviewMode,
  type HtmlSanitizeWarning,
  type PreparedContentHtml,
} from "./types";

function countPaywallMarkers(rawHtml: string): number {
  return rawHtml.split(PAYWALL_MARKER).length - 1;
}

function validateModeCombination(
  accessLevel: ContentAccessLevel,
  previewMode: ContentPreviewMode,
): void {
  if (
    (accessLevel === "public" || accessLevel === "private") &&
    previewMode === "none"
  ) {
    return;
  }

  if (
    accessLevel === "member" &&
    (previewMode === "paywall_marker" || previewMode === "summary_only")
  ) {
    return;
  }

  throw new ContentHtmlError(
    "INVALID_PREVIEW_MODE",
    "内容访问级别与预览模式组合无效",
    "previewMode",
  );
}

function requireMeaningfulHtml(html: string, code = "EMPTY_BODY_AFTER_SANITIZE") {
  if (!hasMeaningfulSanitizedHtml(html)) {
    throw new ContentHtmlError(code, "HTML 清洗后正文为空");
  }
}

function mergeWarnings(
  ...warningGroups: HtmlSanitizeWarning[][]
): HtmlSanitizeWarning[] {
  const seen = new Set<string>();
  const merged: HtmlSanitizeWarning[] = [];

  for (const warning of warningGroups.flat()) {
    const key = `${warning.code}:${warning.tag ?? ""}:${warning.attribute ?? ""}`;

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(warning);
    }
  }

  return merged;
}

export function prepareContentHtml(input: {
  rawHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
}): PreparedContentHtml {
  if (!input.rawHtml.trim()) {
    throw new ContentHtmlError("BODY_REQUIRED", "正文不能为空");
  }

  if (input.rawHtml.length > MAX_CONTENT_HTML_CHARS) {
    throw new ContentHtmlError(
      "BODY_TOO_LARGE",
      "正文不能超过 512 KiB 字符",
    );
  }

  validateModeCombination(input.accessLevel, input.previewMode);
  const markerCount = countPaywallMarkers(input.rawHtml);

  if (input.previewMode === "paywall_marker") {
    if (markerCount === 0) {
      throw new ContentHtmlError(
        "PAYWALL_MARKER_REQUIRED",
        `会员试读正文必须包含一个 ${PAYWALL_MARKER}`,
      );
    }

    if (markerCount > 1) {
      throw new ContentHtmlError(
        "MULTIPLE_PAYWALL_MARKERS",
        "会员试读正文只能包含一个付费墙标记",
      );
    }

    const [publicRaw, memberRaw] = input.rawHtml.split(PAYWALL_MARKER);
    const publicSegment = sanitizeHtmlSegment(publicRaw);
    const memberSegment = sanitizeHtmlSegment(memberRaw);

    if (!hasMeaningfulSanitizedHtml(publicSegment.html)) {
      throw new ContentHtmlError(
        "EMPTY_PUBLIC_PREVIEW_AFTER_SANITIZE",
        "付费墙之前的公开试读内容清洗后为空",
      );
    }

    if (!hasMeaningfulSanitizedHtml(memberSegment.html)) {
      throw new ContentHtmlError(
        "EMPTY_MEMBER_BODY_AFTER_SANITIZE",
        "付费墙之后的会员内容清洗后为空",
      );
    }

    return {
      bodyHtml: `${publicSegment.html}${PAYWALL_MARKER}${memberSegment.html}`,
      warnings: mergeWarnings(
        publicSegment.warnings,
        memberSegment.warnings,
      ),
    };
  }

  if (markerCount > 0) {
    throw new ContentHtmlError(
      "PAYWALL_MARKER_NOT_ALLOWED",
      "当前预览模式不允许包含付费墙标记",
    );
  }

  const sanitized = sanitizeHtmlSegment(input.rawHtml);
  requireMeaningfulHtml(sanitized.html);

  return {
    bodyHtml: sanitized.html,
    warnings: sanitized.warnings,
  };
}
