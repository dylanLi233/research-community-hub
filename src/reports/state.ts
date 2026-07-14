export type ResearchReportStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export function canPublishReport(status: ResearchReportStatus): boolean {
  return (
    status === "draft" ||
    status === "pending_review" ||
    status === "rejected" ||
    status === "archived"
  );
}

export function canArchiveReport(status: ResearchReportStatus): boolean {
  return status === "published";
}
