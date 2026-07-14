export const PAYWALL_MARKER = "<!-- PAYWALL -->";
export const MAX_CONTENT_HTML_CHARS = 512 * 1024;

export type ContentAccessLevel = "public" | "member" | "private";
export type ContentPreviewMode = "none" | "paywall_marker" | "summary_only";
export type ContentAudience = "visitor" | "member" | "admin";

export type HtmlSanitizeWarning = {
  code:
    | "HTML_TAG_REMOVED"
    | "HTML_ATTRIBUTE_REMOVED"
    | "HTML_URL_REMOVED";
  tag?: string;
  attribute?: string;
};

export type PreparedContentHtml = {
  bodyHtml: string;
  warnings: HtmlSanitizeWarning[];
};

export type RenderedContentHtml = {
  html: string;
  hasFullAccess: boolean;
  isRestricted: boolean;
};

export class ContentHtmlError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field = "bodyHtml",
  ) {
    super(message);
    this.name = "ContentHtmlError";
  }
}
