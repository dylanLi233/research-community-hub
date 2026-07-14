import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
import {
  importResearchReport,
  ImportReportServiceError,
} from "@/imports/report-service";
import { importReportSchema } from "@/imports/report-validation";
import { requireApiClientRequest } from "@/integrations/auth";
import { generateId } from "@/auth/token";
import { validationDetails, type ApiErrorDetail } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const ENDPOINT = "/api/v1/import/reports";

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

function response(body: ImportResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function persistFailure(input: {
  db: Awaited<ReturnType<typeof requireApiClientRequest>> extends infer _T
    ? never
    : never;
}): Promise<never> {
  throw new Error(String(input));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authorization = await requireApiClientRequest(request, "reports:write");

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
      const requestId = generateId();
      return response(
        errorBody({
          requestId,
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
  const rawBody = await request.text();

  if (byteLength(rawBody) > MAX_IMPORT_BODY_BYTES) {
    const requestHash = await hashImportRequest(rawBody);
    const body = errorBody({
      requestId,
      clientRequestId,
      code: "PAYLOAD_TOO_LARGE",
      message: "请求体不能超过 1 MiB",
      retryable: false,
    });

    try {
      await recordImportFailure(authorization.db, {
        requestId,
        apiClientId: authorization.client.id,
        idempotencyKey,
        requestHash,
        endpoint: ENDPOINT,
        httpStatus: 413,
        errorCode: "PAYLOAD_TOO_LARGE",
        responseData: body,
        durationMs: Date.now() - startedAt,
      });
    } catch {
      const replay = await findImportReplay(
        authorization.db,
        authorization.client.id,
        idempotencyKey,
        requestHash,
      );

      if (replay) {
        return response(replay.body, replay.httpStatus);
      }
    }

    return response(body, 413);
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    const requestHash = await hashImportRequest(rawBody);

    try {
      const replay = await findImportReplay(
        authorization.db,
        authorization.client.id,
        idempotencyKey,
        requestHash,
      );

      if (replay) {
        return response(replay.body, replay.httpStatus);
      }
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return response(
          errorBody({
            requestId,
            clientRequestId,
            code: error.code,
            message: error.message,
            retryable: false,
          }),
          error.status,
        );
      }

      throw error;
    }

    const body = errorBody({
      requestId,
      clientRequestId,
      code: "INVALID_JSON",
      message: "请求体必须是有效的 JSON",
      retryable: false,
    });
    await recordImportFailure(authorization.db, {
      requestId,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      endpoint: ENDPOINT,
      httpStatus: 400,
      errorCode: "INVALID_JSON",
      responseData: body,
      durationMs: Date.now() - startedAt,
    });
    return response(body, 400);
  }

  const requestHash = await hashImportRequest(parsedJson);

  try {
    const replay = await findImportReplay(
      authorization.db,
      authorization.client.id,
      idempotencyKey,
      requestHash,
    );

    if (replay) {
      return response(replay.body, replay.httpStatus);
    }
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return response(
        errorBody({
          requestId,
          clientRequestId,
          code: error.code,
          message: error.message,
          retryable: false,
        }),
        error.status,
      );
    }

    throw error;
  }

  const validated = importReportSchema.safeParse(parsedJson);

  if (!validated.success) {
    const details = validationDetails(validated.error.issues);
    const body = errorBody({
      requestId,
      clientRequestId,
      code: "VALIDATION_FAILED",
      message: "提交内容未通过校验",
      retryable: false,
      details,
    });
    await recordImportFailure(authorization.db, {
      requestId,
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      endpoint: ENDPOINT,
      externalId:
        parsedJson && typeof parsedJson === "object"
          ? String(
              (parsedJson as Record<string, unknown>).external_id ?? "",
            ) || null
          : null,
      httpStatus: 400,
      errorCode: "VALIDATION_FAILED",
      responseData: body,
      durationMs: Date.now() - startedAt,
    });
    return response(body, 400);
  }

  try {
    const result = await importResearchReport(authorization.db, {
      apiClientId: authorization.client.id,
      idempotencyKey,
      requestHash,
      requestId,
      clientRequestId,
      report: validated.data,
      startedAt,
    });

    return response(result.body, result.httpStatus);
  } catch (error) {
    try {
      const replay = await findImportReplay(
        authorization.db,
        authorization.client.id,
        idempotencyKey,
        requestHash,
      );

      if (replay) {
        return response(replay.body, replay.httpStatus);
      }
    } catch (replayError) {
      if (replayError instanceof IdempotencyConflictError) {
        return response(
          errorBody({
            requestId,
            clientRequestId,
            code: replayError.code,
            message: replayError.message,
            retryable: false,
          }),
          replayError.status,
        );
      }
    }

    const serviceError =
      error instanceof ImportReportServiceError
        ? error
        : new ImportReportServiceError(
            "INTERNAL_ERROR",
            "研报导入暂时不可用",
            500,
          );
    const body = errorBody({
      requestId,
      clientRequestId,
      code: serviceError.code,
      message: serviceError.message,
      retryable: serviceError.status >= 500,
      details: serviceError.details,
    });

    try {
      await recordImportFailure(authorization.db, {
        requestId,
        apiClientId: authorization.client.id,
        idempotencyKey,
        requestHash,
        endpoint: ENDPOINT,
        externalId: validated.data.externalId,
        httpStatus: serviceError.status,
        errorCode: serviceError.code,
        responseData: body,
        durationMs: Date.now() - startedAt,
      });
    } catch (recordError) {
      console.error("Failed to record report import failure", recordError);
    }

    return response(body, serviceError.status);
  }
}
