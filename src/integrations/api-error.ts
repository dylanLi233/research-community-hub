import { IntegrationServiceError } from "./service";
import { apiError } from "@/lib/api-response";

export function integrationServiceErrorResponse(error: unknown) {
  if (error instanceof IntegrationServiceError) {
    return apiError(error.code, error.message, error.status, {
      details: error.details,
    });
  }

  console.error("Integration management operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "Hermes 接入管理操作暂时不可用", 500);
}
