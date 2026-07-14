export type PublicReportState = {
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  accessLevel: "public" | "member" | "private";
  publishedAt: Date | null;
  scheduledAt: Date | null;
  deletedAt: Date | null;
};

export function isReportPubliclyVisible(
  report: PublicReportState,
  now = new Date(),
): boolean {
  if (
    report.status !== "published" ||
    report.accessLevel === "private" ||
    report.deletedAt !== null ||
    report.publishedAt === null ||
    report.publishedAt > now
  ) {
    return false;
  }

  return report.scheduledAt === null || report.scheduledAt <= now;
}
