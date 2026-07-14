import { ReportServiceError } from "./service";
import { apiError } from "@/lib/api-response";

export function reportServiceErrorResponse(error: unknown) {
  if (error instanceof ReportServiceError) {
    return apiError(error.code, error.message, error.status, {
      details: error.details,
    });
  }

  console.error("Research report operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "研报管理操作暂时不可用", 500);
}
