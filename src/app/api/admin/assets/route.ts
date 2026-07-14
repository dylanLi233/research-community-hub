import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  assetListQuerySchema,
  assetUploadMetadataSchema,
} from "@/assets/request-validation";
import { createAdminAsset, listAdminAssets } from "@/assets/service";
import { getMediaBucket } from "@/assets/storage";
import {
  AssetValidationError,
  validateAssetFile,
} from "@/assets/validation";
import { requireAdminRequest } from "@/auth/authorization";
import { isSameOriginRequest } from "@/auth/origin";
import { apiError, validationDetails } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    const parsed = assetListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return apiError("VALIDATION_FAILED", "查询参数格式不正确", 400, {
        details: validationDetails(parsed.error.issues),
      });
    }

    const result = await listAdminAssets(authorization.db, parsed.data);

    return NextResponse.json(
      {
        data: {
          ...result,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          pageCount: Math.ceil(result.total / parsed.data.pageSize),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to list assets", error);
    return apiError("INTERNAL_ERROR", "素材列表读取失败", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiError("ORIGIN_NOT_ALLOWED", "请求来源无效", 403);
  }

  try {
    const authorization = await requireAdminRequest(request);

    if ("response" in authorization) {
      return authorization.response;
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return apiError(
        "INVALID_MULTIPART_BODY",
        "请求体必须是有效的 Multipart Form Data",
        400,
      );
    }

    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return apiError("FILE_REQUIRED", "必须上传图片文件", 400, {
        details: [
          { field: "file", code: "REQUIRED", message: "图片文件不能为空" },
        ],
      });
    }

    const metadata = assetUploadMetadataSchema.safeParse({
      accessLevel: formData.get("accessLevel") ?? undefined,
      altText: formData.get("altText") ?? "",
    });

    if (!metadata.success) {
      return apiError("VALIDATION_FAILED", "素材信息格式不正确", 400, {
        details: validationDetails(metadata.error.issues),
      });
    }

    const validatedFile = await validateAssetFile(fileValue);
    const bucket = await getMediaBucket();
    const asset = await createAdminAsset(authorization.db, bucket, {
      actorUserId: authorization.session.user.id,
      file: validatedFile,
      accessLevel: metadata.data.accessLevel,
      altText: metadata.data.altText,
    });

    return NextResponse.json(
      { data: { asset } },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof AssetValidationError) {
      return apiError(error.code, error.message, error.status, {
        details: [
          { field: error.field, code: error.code, message: error.message },
        ],
      });
    }

    console.error("Failed to upload asset", error);
    return apiError("ASSET_UPLOAD_FAILED", "素材上传失败", 500);
  }
}
