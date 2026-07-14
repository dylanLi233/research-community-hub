import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { assetErrorResponse } from "@/assets/api-error";
import { createAdminAsset, listAdminAssets } from "@/assets/service";
import { assetListQuerySchema } from "@/assets/validation";
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
    return assetErrorResponse(error);
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
        "请求体必须是有效的 multipart/form-data",
        400,
      );
    }

    const file = formData.get("file");
    const altTextValue = formData.get("altText");

    if (!(file instanceof File)) {
      return apiError("FILE_REQUIRED", "必须上传一个图片文件", 400);
    }

    if (altTextValue !== null && typeof altTextValue !== "string") {
      return apiError("INVALID_ALT_TEXT", "图片说明格式不正确", 400);
    }

    const asset = await createAdminAsset(
      authorization.db,
      authorization.session.user.id,
      file,
      altTextValue,
    );

    return NextResponse.json(
      { data: { asset } },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return assetErrorResponse(error);
  }
}
