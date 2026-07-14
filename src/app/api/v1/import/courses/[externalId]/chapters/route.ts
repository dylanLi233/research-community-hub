import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import {
  importCourseChapter,
  ImportCourseServiceError,
} from "@/imports/course-service";
import { importChapterSchema } from "@/imports/course-validation";
import {
  byteLength,
  hashImportRequest,
  ImportRequestError,
  MAX_IMPORT_BODY_BYTES,
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

type RouteContext = {
  params: Promise<{ externalId: string }>;
};

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
  courseExternalId: string;
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
  const endpoint = `/api/v1/import/courses/${input.courseExternalId}/chapters`;
  const body = errorBody(input);
  try {
    await recordImportFailure(input.db, {
      requestId: input.requestId,
      apiClientId: input.apiClientId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      endpoint,
      externalId: input.externalId,
      contentType: "course_chapter",
      resourceType: "course_chapter",
      httpStatus: input.status,
      errorCode: input.code,
      responseData: body,
      durationMs: Date.now() - input.startedAt,
    });
  } catch (error) {
    const replay = await replayOrConflict(input);
    if (replay) return replay;
    throw error;
  }
  return jsonResponse(body, input.status);
}

function externalIdFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const externalId = (value as Record<string, unknown>).external_id;
  return typeof externalId === "string" && externalId ? externalId : null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  const authorization = await requireApiClientRequest(request, "courses:write");
  if ("response" in authorization) return authorization.response;

  const { externalId: courseExternalId } = await context.params;
  const endpoint = `/api/v1/import/courses/${courseExternalId}/chapters`;
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
            ? [{ field: error.field, code: error.code, message: error.message }]
            : undefined,
        }),
        error.status,
      );
    }
    throw error;
  }

  const requestId = generateId();
  const rawBody = await request.text();
  if (byteLength(rawBody) > MAX_IMPORT_BODY_BYTES) {
    const requestHash = await hashImportRequest({
      endpoint,
      courseExternalId,
      rawBody,
    });
    const replay = await replayOrConflict({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
    });
    if (replay) return replay;
    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      courseExternalId,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "请求体不能超过 1 MiB",
      retryable: false,
      startedAt,
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    const requestHash = await hashImportRequest({
      endpoint,
      courseExternalId,
      rawBody,
    });
    const replay = await replayOrConflict({
      db: authorization.db,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
    });
    if (replay) return replay;
    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      courseExternalId,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      status: 400,
      code: "INVALID_JSON",
      message: "请求体必须是有效的 JSON",
      retryable: false,
      startedAt,
    });
  }

  const requestHash = await hashImportRequest({
    endpoint,
    courseExternalId,
    body: parsedJson,
  });
  const replay = await replayOrConflict({
    db: authorization.db,
    apiClientId: authorization.client.id,
    idempotencyKey,
    requestHash,
    requestId,
    clientRequestId,
  });
  if (replay) return replay;

  const validated = importChapterSchema.safeParse(parsedJson);
  if (!validated.success) {
    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      courseExternalId,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      externalId: externalIdFromJson(parsedJson),
      status: 400,
      code: "VALIDATION_FAILED",
      message: "章节内容未通过校验",
      retryable: false,
      details: validationDetails(validated.error.issues),
      startedAt,
    });
  }

  try {
    const result = await importCourseChapter(authorization.db, {
      apiClientId: authorization.client.id,
      courseExternalId,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      payload: validated.data,
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
    if (concurrentReplay) return concurrentReplay;

    const serviceError =
      error instanceof ImportCourseServiceError
        ? error
        : new ImportCourseServiceError(
            "INTERNAL_ERROR",
            "章节导入暂时不可用",
            500,
          );
    return persistFailure({
      db: authorization.db,
      apiClientId: authorization.client.id,
      courseExternalId,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      externalId: validated.data.externalId,
      status: serviceError.status,
      code: serviceError.code,
      message: serviceError.message,
      retryable: serviceError.status >= 500,
      details: serviceError.details,
      startedAt,
    });
  }
}
