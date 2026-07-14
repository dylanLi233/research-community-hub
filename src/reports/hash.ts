export type ReportHashInput = {
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  bodyHtml: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  sourceInstitution: string;
  sourceReportDate: string | null;
  authorName: string | null;
  coverAssetId: string | null;
  tags: string[];
  scheduledAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

function canonicalReportContent(input: ReportHashInput): string {
  return JSON.stringify({
    title: input.title,
    subtitle: input.subtitle,
    slug: input.slug,
    summary: input.summary,
    bodyHtml: input.bodyHtml,
    accessLevel: input.accessLevel,
    previewMode: input.previewMode,
    sourceInstitution: input.sourceInstitution,
    sourceReportDate: input.sourceReportDate,
    authorName: input.authorName,
    coverAssetId: input.coverAssetId,
    tags: input.tags,
    scheduledAt: input.scheduledAt?.toISOString() ?? null,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  });
}

export async function hashReportContent(input: ReportHashInput): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalReportContent(input));
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
