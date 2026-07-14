import type { CourseContentStatus } from "@/courses/state";

export type CourseImportAction = "created" | "updated" | "unchanged";

export function decideCourseImportAction(
  currentHash: string | null,
  nextHash: string,
): CourseImportAction {
  if (currentHash === null) {
    return "created";
  }

  return currentHash === nextHash ? "unchanged" : "updated";
}

export function decideCourseImportOutcome(input: {
  action: CourseImportAction;
  currentStatus: CourseContentStatus | null;
  reviewMode: "on" | "off";
}): { status: CourseContentStatus; httpStatus: number } {
  if (input.action === "unchanged") {
    return { status: input.currentStatus ?? "draft", httpStatus: 200 };
  }

  if (input.reviewMode === "on") {
    return { status: "pending_review", httpStatus: 202 };
  }

  return {
    status: "published",
    httpStatus: input.action === "created" ? 201 : 200,
  };
}

export function canImportChapterToCourse(input: {
  status: CourseContentStatus;
  deleted: boolean;
}): boolean {
  return !input.deleted && input.status !== "archived";
}
