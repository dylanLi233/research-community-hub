import type { AuthenticatedSession } from "@/auth/session";
import type { AppDatabase } from "@/db/client";
import {
  resolveReportAudience,
  type ReportAudienceContext,
} from "@/reports/audience";

export type CourseAudienceContext = ReportAudienceContext;

export async function resolveCourseAudience(
  db: AppDatabase,
  session: AuthenticatedSession | null,
): Promise<CourseAudienceContext> {
  return resolveReportAudience(db, session);
}
