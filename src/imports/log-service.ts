import { and, eq } from "drizzle-orm";

import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { importResponseSnapshots } from "@/db/import-schema";
import { importRequests } from "@/db/schema";

export type ImportResponseBody = Record<string, unknown>;

export type ImportReplay = {
  requestId: string;
  httpStatus: number;
  body: ImportResponseBody;
};

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
  readonly status = 409;

  constructor() {
    super("相同 Idempotency-Key 已用于不同请求");
    this.name = "IdempotencyConflictError";
  }
}

export async function findImportReplay(
  db: AppDatabase,
  apiClientId: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<ImportReplay | null> {
  const [record] = await db
    .select({
      requestId: importRequests.id,
      requestHash: importRequests.requestHash,
      httpStatus: importRequests.httpStatus,
      responseData: importResponseSnapshots.responseData,
    })
    .from(importRequests)
    .innerJoin(
      importResponseSnapshots,
      eq(importRequests.id, importResponseSnapshots.importRequestId),
    )
    .where(
      and(
        eq(importRequests.apiClientId, apiClientId),
        eq(importRequests.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.requestHash !== requestHash) {
    throw new IdempotencyConflictError();
  }

  return {
    requestId: record.requestId,
    httpStatus: record.httpStatus,
    body: record.responseData,
  };
}

export async function recordImportFailure(
  db: AppDatabase,
  input: {
    requestId?: string;
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    endpoint: string;
    externalId?: string | null;
    contentType?: string;
    resourceType?: string;
    httpStatus: number;
    errorCode: string;
    responseData: ImportResponseBody;
    durationMs: number;
  },
): Promise<string> {
  const requestId = input.requestId ?? generateId();
  const now = new Date();
  const contentType = input.contentType ?? "research_report";
  const resourceType = input.resourceType ?? contentType;

  await db.batch([
    db.insert(importRequests).values({
      id: requestId,
      apiClientId: input.apiClientId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      endpoint: input.endpoint,
      externalId: input.externalId ?? null,
      contentType,
      result: "failure",
      httpStatus: input.httpStatus,
      errorCode: input.errorCode,
      resourceType,
      durationMs: input.durationMs,
      createdAt: now,
    }),
    db.insert(importResponseSnapshots).values({
      importRequestId: requestId,
      responseData: input.responseData,
    }),
  ]);

  return requestId;
}

export async function getImportStatus(
  db: AppDatabase,
  apiClientId: string,
  requestId: string,
): Promise<ImportReplay | null> {
  const [record] = await db
    .select({
      requestId: importRequests.id,
      httpStatus: importRequests.httpStatus,
      responseData: importResponseSnapshots.responseData,
    })
    .from(importRequests)
    .innerJoin(
      importResponseSnapshots,
      eq(importRequests.id, importResponseSnapshots.importRequestId),
    )
    .where(
      and(
        eq(importRequests.id, requestId),
        eq(importRequests.apiClientId, apiClientId),
      ),
    )
    .limit(1);

  return record
    ? {
        requestId: record.requestId,
        httpStatus: record.httpStatus,
        body: record.responseData,
      }
    : null;
}
