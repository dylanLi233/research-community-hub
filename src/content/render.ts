import {
  PAYWALL_MARKER,
  type ContentAccessLevel,
  type ContentAudience,
  type ContentPreviewMode,
  type RenderedContentHtml,
} from "./types";

function removePaywallMarkers(bodyHtml: string): string {
  return bodyHtml.split(PAYWALL_MARKER).join("");
}

export function renderContentHtml(input: {
  bodyHtml: string;
  accessLevel: ContentAccessLevel;
  previewMode: ContentPreviewMode;
  audience: ContentAudience;
}): RenderedContentHtml {
  if (input.accessLevel === "public") {
    return {
      html: removePaywallMarkers(input.bodyHtml),
      hasFullAccess: true,
      isRestricted: false,
    };
  }

  if (input.accessLevel === "private") {
    const allowed = input.audience === "admin";

    return {
      html: allowed ? removePaywallMarkers(input.bodyHtml) : "",
      hasFullAccess: allowed,
      isRestricted: !allowed,
    };
  }

  const hasFullAccess =
    input.audience === "member" || input.audience === "admin";

  if (hasFullAccess) {
    return {
      html: removePaywallMarkers(input.bodyHtml),
      hasFullAccess: true,
      isRestricted: false,
    };
  }

  if (input.previewMode === "paywall_marker") {
    return {
      html: input.bodyHtml.split(PAYWALL_MARKER, 1)[0] ?? "",
      hasFullAccess: false,
      isRestricted: true,
    };
  }

  return {
    html: "",
    hasFullAccess: false,
    isRestricted: true,
  };
}
