export type CourseContentStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export function canPublishCourseContent(status: CourseContentStatus): boolean {
  return (
    status === "draft" ||
    status === "pending_review" ||
    status === "rejected" ||
    status === "archived"
  );
}

export function canArchiveCourseContent(status: CourseContentStatus): boolean {
  return status === "published";
}

export function canPublishChapterWithinCourse(input: {
  courseStatus: CourseContentStatus;
  courseDeleted: boolean;
}): boolean {
  return !input.courseDeleted && input.courseStatus !== "archived";
}
