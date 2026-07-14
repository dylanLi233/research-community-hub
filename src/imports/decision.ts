export type ReportImportAction = "created" | "updated" | "unchanged";
export type ReportImportStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export function decideReportImportAction(
  existingContentHash: string | null,
  nextContentHash: string,
): ReportImportAction {
  if (existingContentHash === null) {
    return "created";
  }

  return existingContentHash === nextContentHash ? "unchanged" : "updated";
}

export function decideReportImportOutcome(input: {
  action: ReportImportAction;
  currentStatus: ReportImportStatus | null;
  reviewMode: "on" | "off";
}): { status: ReportImportStatus; httpStatus: number } {
  if (input.action === "unchanged") {
    return {
      status: input.currentStatus ?? "draft",
      httpStatus: 200,
    };
  }

  if (input.reviewMode === "on") {
    return { status: "pending_review", httpStatus: 202 };
  }

  return {
    status: "published",
    httpStatus: input.action === "created" ? 201 : 200,
  };
}
