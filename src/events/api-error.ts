import { EventServiceError } from "./service";
import { apiError } from "@/lib/api-response";

export function eventServiceErrorResponse(error: unknown) {
  if (error instanceof EventServiceError) {
    return apiError(error.code, error.message, error.status, {
      details: error.details,
    });
  }

  console.error("Market event operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "事件管理操作暂时不可用", 500);
}
