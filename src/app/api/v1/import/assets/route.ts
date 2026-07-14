import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getMediaBucket } from "@/assets/storage";
import {
  AssetValidationError,
  sha256Hex,
  validateAssetFile,
} from "@/assets/validation";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { importAsset, ImportAssetServiceError } from "@/imports/asset-service";
import {
  formDataString,
  importAssetMetadataSchema,
  MAX_ASSET_IMPORT_REQUEST_BYTES,
} from "@/imports/asset-validation";
import {
  hashImportRequest,
  ImportRequestError,
  validateClientRequestId,
  validateIdempotencyKey,
} from "@/imports/idempotency";
import {
  findImportReplay,
  IdempotencyConflictError,
  recordImportFailure,
  type ImportResponseBody,
} from "@/imports/log-service";
import { requireApiClientRequest } from "@/integrations/auth";
import { validationDetails, type ApiErrorDetail } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const ENDPOINT = "/api/v1/import/assets";

function errorBody(input: {
  requestId: string;
  clientRequestId: string | null;
  code: string;
  message: string;
  retryable: boolean;
  details?: ApiErrorDetail[];
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable,
      ...(input.details ? { details: input.details } : {}),
    },
  };
}

function jsonResponse(body: ImportResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function replayOrConflict(input: {
  db: AppDatabase;
  apiClientId: string;
  idempotencyKey: string;
  requestHash: string;
  requestId: string;
  clientRequestId: string | null;
}): Promise<NextResponse | null> {
  try {
    const replay = await findImportReplay(
      input.db,
      input.apiClientId,
      input.idempotencyKey,
      input.requestHash,
    );

    return replay ? jsonResponse(replay.body, replay.httpStatus) : null;
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return jsonResponse(
        errorBody({
          requestId: input.requestId,
          clientRequestId: input.clientRequestId,
          code: error.code,
          message: error.message,
          retryable: false,
        }),
        error.status,
      );
    }

    throw error;
  }
}

async function persistFailure(input: {
  db: AppDatabase;
  apiClientId: string;
  idempotencyKey: string;
  requestHash: string;
  requestId: string;
  clientRequestId: string | null;
  externalId?: string | null;
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  details?: ApiErrorDetail[];
  startedAt: number;
}): Promise<NextResponse> {
  const body = errorBody(input);

  try {
    await recordImportFailure(input.db, {
      requestId: input.requestId,
      apiClientId: input.apiClientId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      endpoint: ENDPOINT,
      externalId: input.externalId,
      contentType: "asset",
      resourceType: "asset",
      httpStatus: input.status,
      errorCode: input.code,
      responseData: body,
      durationMs: Date.now() - input.startedAt,
    });
  } catch (error) {
    const replay = await replayOrConflict(input);

    if (replay) {
      return replay;
    }

    throw error;
  }

  return jsonResponse(body, input.status);
}

function metadataDetails(
  details: ReturnType<typeof validationDetails>,
): ApiErrorDetail[] {
  const fieldMap: Record<string, string> = {
    externalId: "external_id",
    accessLevel: "access_level",
    altText: "alt_text",
  };

  return details.map((detail) => ({
    ...detail,
    field: detail.field ? (fieldMap[detail.field] ?? detail.field) : detail.field,
  }));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authorization = await requireApiClientRequest(request, "assets:write");

  if ("response" in authorization) {
    return authorization.response;
  }

  let idempotencyKey: string;
  let clientRequestId: string | null;

  try {
    idempotencyKey = validateIdempotencyKey(
      request.headers.get("idempotency-key"),
    );
    clientRequestId = validateClientRequestId(
      request.headers.get("x-request-id"),
    );
  } catch (error) {
    if (error instanceof ImportRequestError) {
      return jsonResponse(
        errorBody({
          requestId: generateId(),
          clientRequestId: null,
          code: error.code,
          message: error.message,
          retryable: false,
          details: error.field
            ? [
                {
                  field: error.field,
                  code: error.code,
                  message: error.message,
                },
              ]
            : undefined,
        }),
        error.status,
      );
    }

    throw error;
  }

  const requestId = generateId();
  const rawBytes = await request.clone().arrayBuffer();
  const rawRequestHash = await sha256Hex(rawBytes);

  if (rawBytes.byteLength > MAX_ASSET_IMPORT_REQUEST_BYTES) {
    const replay = await replayOrConflict({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash: rawRequestHash,
      requestId,
      clientRequestId,
    });

    if (replay) {
      return replay;
    }

    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash: rawRequestHash,
      requestId,
      clientRequestId,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Multipart 请求不能超过 10.5 MiB",
      retryable: false,
      startedAt,
    });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    const replay = await replayOrConflict({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash: rawRequestHash,
      requestId,
      clientRequestId,
    });

    if (replay) {
      return replay;
    }

    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash: rawRequestHash,
      requestId,
      clientRequestId,
      status: 400,
      code: "INVALID_MULTIPART_BODY",
      message: "请求体必须是有效的 Multipart Form Data",
      retryable: false,
      startedAt,
    });
  }

  const metadataResult = importAssetMetadataSchema.safeParse({
    externalId: formDataString(formData, "external_id"),
    accessLevel: formDataString(formData, "access_level"),
    altText: formDataString(formData, "alt_text") ?? null,
  });
  const fileValue = formData.get("file");

  if (!metadataResult.success || !(fileValue instanceof File)) {
    const details = metadataResult.success
      ? []
      : metadataDetails(validationDetails(metadataResult.error.issues));

    if (!(fileValue instanceof File)) {
      details.push({
        field: "file",
        code: "FILE_REQUIRED",
        message: "必须上传图片文件",
      });
    }

    const externalId = formDataString(formData, "external_id") ?? null;
    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash: rawRequestHash,
      requestId,
      clientRequestId,
      externalId,
      status: 400,
      code: "VALIDATION_FAILED",
      message: "素材请求未通过校验",
      retryable: false,
      details,
      startedAt,
    });
  }

  let validatedFile: Awaited<ReturnType<typeof validateAssetFile>>;

  try {
    validatedFile = await validateAssetFile(fileValue);
  } catch (error) {
    if (error instanceof AssetValidationError) {
      return persistFailure({
        db: authorization.db,
        apiClientId: authorization.client.id,
        idempotencyKey,
        requestHash: rawRequestHash,
        requestId,
        clientRequestId,
        externalId: metadataResult.data.externalId,
        status: error.status,
        code: error.code,
        message: error.message,
        retryable: false,
        details: [
          { field: "file", code: error.code, message: error.message },
        ],
        startedAt,
      });
    }

    throw error;
  }

  const requestHash = await hashImportRequest({
    external_id: metadataResult.data.externalId,
    access_level: metadataResult.data.accessLevel,
    alt_text: metadataResult.data.altText ?? null,
    file_sha256: validatedFile.sha256,
  });
  const replay = await replayOrConflict({
    db: authorization.db,
    apiClientId: authorization.client.id,
    idempotencyKey,
    requestHash,
    requestId,
    clientRequestId,
  });

  if (replay) {
    return replay;
  }

  try {
    const bucket = await getMediaBucket();
    const result = await importAsset(authorization.db, bucket, {
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      metadata: metadataResult.data,
      file: validatedFile,
      startedAt,
    });

    return jsonResponse(result.body, result.httpStatus);
  } catch (error) {
    const concurrentReplay = await replayOrConflict({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
    });

    if (concurrentReplay) {
      return concurrentReplay;
    }

    const serviceError =
      error instanceof ImportAssetServiceError
        ? error
        : new ImportAssetServiceError(
            "INTERNAL_ERROR",
            "素材导入暂时不可用",
            500,
          );

    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      externalId: metadataResult.data.externalId,
      status: serviceError.status,
      code: serviceError.code,
      message: serviceError.message,
      retryable: serviceError.status >= 500,
      details: serviceError.details,
      startedAt,
    });
  }
}
