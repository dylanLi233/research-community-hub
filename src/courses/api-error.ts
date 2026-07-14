import { CourseServiceError } from "./service";
import { apiError } from "@/lib/api-response";

export function courseServiceErrorResponse(error: unknown) {
  if (error instanceof CourseServiceError) {
    return apiError(error.code, error.message, error.status, {
      details: error.details,
    });
  }

  console.error("Course administration operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "课程管理操作暂时不可用", 500);
}
