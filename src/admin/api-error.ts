import { AdminUserServiceError } from "./user-service";
import { apiError } from "@/lib/api-response";

export function adminServiceErrorResponse(error: unknown) {
  if (error instanceof AdminUserServiceError) {
    return apiError(error.code, error.message, error.status);
  }

  console.error("Admin user operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "用户管理操作暂时不可用", 500);
}
