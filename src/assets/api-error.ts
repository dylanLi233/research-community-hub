import { AssetValidationError } from "./image";
import { AssetServiceError } from "./service";
import { apiError } from "@/lib/api-response";

export function assetErrorResponse(error: unknown) {
  if (error instanceof AssetValidationError) {
    return apiError(error.code, error.message, error.status);
  }

  if (error instanceof AssetServiceError) {
    return apiError(error.code, error.message, error.status);
  }

  console.error("Asset operation failed unexpectedly", error);
  return apiError("INTERNAL_ERROR", "素材操作暂时不可用", 500);
}
