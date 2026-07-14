import { and, eq } from "drizzle-orm";

import { decideAssetImport } from "./asset-decision";
import type { ImportAssetMetadata } from "./asset-validation";
import type { ImportResponseBody } from "./log-service";
import { buildAssetStorageKey, storeAssetObject } from "@/assets/storage";
import type { ValidatedAssetFile } from "@/assets/validation";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { assets } from "@/db/assets-schema";
import { importResponseSnapshots } from "@/db/import-schema";
import { auditLogs, importRequests } from "@/db/schema";

export class ImportAssetServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Array<{
      field?: string;
      code: string;
      message: string;
    }>,
  ) {
    super(message);
    this.name = "ImportAssetServiceError";
  }
}

export type ImportAssetResult = {
  httpStatus: number;
  body: ImportResponseBody;
};

function successBody(input: {
  requestId: string;
  clientRequestId: string | null;
  action: "created" | "unchanged";
  assetId: string;
  externalId: string;
  accessLevel: "public" | "member" | "private";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  sha256: string;
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    data: {
      action: input.action,
      asset_id: input.assetId,
      external_id: input.externalId,
      access_level: input.accessLevel,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      sha256: input.sha256,
      url: `/media/${input.assetId}`,
      warnings: [],
    },
  };
}

export async function importAsset(
  db: AppDatabase,
  bucket: R2Bucket,
  input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    requestId: string;
    clientRequestId: string | null;
    metadata: ImportAssetMetadata;
    file: ValidatedAssetFile;
    startedAt: number;
  },
): Promise<ImportAssetResult> {
  const [existing] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.uploadedByApiClientId, input.apiClientId),
        eq(assets.externalId, input.metadata.externalId),
      ),
    )
    .limit(1);
  const decision = decideAssetImport({
    existing: existing
      ? {
          status: existing.status,
          sha256: existing.sha256,
          accessLevel: existing.accessLevel,
          altText: existing.altText,
        }
      : null,
    sha256: input.file.sha256,
    accessLevel: input.metadata.accessLevel,
    altText: input.metadata.altText ?? null,
  });

  if (decision.action === "conflict") {
    throw new ImportAssetServiceError(
      decision.code,
      decision.code === "ASSET_EXTERNAL_ID_DELETED"
        ? "该 external_id 对应的素材已删除，不能自动复用"
        : "该 external_id 已绑定不同的素材内容或元数据",
      409,
      [
        {
          field: "external_id",
          code: decision.code,
          message: "请使用新的 external_id 上传不可变素材",
        },
      ],
    );
  }

  const now = new Date();
  const durationMs = Date.now() - input.startedAt;

  if (decision.action === "unchanged") {
    const responseData = successBody({
      requestId: input.requestId,
      clientRequestId: input.clientRequestId,
      action: "unchanged",
      assetId: existing!.id,
      externalId: input.metadata.externalId,
      accessLevel: existing!.accessLevel,
      mimeType: existing!.mimeType,
      sizeBytes: existing!.sizeBytes,
      sha256: existing!.sha256,
    });

    await db.batch([
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/assets",
        externalId: input.metadata.externalId,
        contentType: "asset",
        result: "success",
        httpStatus: 200,
        resourceType: "asset",
        resourceId: existing!.id,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.asset_unchanged",
        resourceType: "asset",
        resourceId: existing!.id,
        metadata: {
          externalId: input.metadata.externalId,
          sha256: existing!.sha256,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);

    return { httpStatus: 200, body: responseData };
  }

  const assetId = generateId();
  const storageKey = buildAssetStorageKey(assetId, input.file.extension, now);
  const responseData = successBody({
    requestId: input.requestId,
    clientRequestId: input.clientRequestId,
    action: "created",
    assetId,
    externalId: input.metadata.externalId,
    accessLevel: input.metadata.accessLevel,
    mimeType: input.file.mimeType,
    sizeBytes: input.file.sizeBytes,
    sha256: input.file.sha256,
  });

  await storeAssetObject(bucket, {
    key: storageKey,
    bytes: input.file.bytes,
    mimeType: input.file.mimeType,
    assetId,
    originalFilename: input.file.originalFilename,
    sha256: input.file.sha256,
  });

  try {
    await db.batch([
      db.insert(assets).values({
        id: assetId,
        externalId: input.metadata.externalId,
        originalFilename: input.file.originalFilename,
        storageKey,
        mimeType: input.file.mimeType,
        sizeBytes: input.file.sizeBytes,
        sha256: input.file.sha256,
        altText: input.metadata.altText ?? null,
        accessLevel: input.metadata.accessLevel,
        status: "active",
        uploadedByApiClientId: input.apiClientId,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/assets",
        externalId: input.metadata.externalId,
        contentType: "asset",
        result: "success",
        httpStatus: 201,
        resourceType: "asset",
        resourceId: assetId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.asset_created",
        resourceType: "asset",
        resourceId: assetId,
        metadata: {
          externalId: input.metadata.externalId,
          accessLevel: input.metadata.accessLevel,
          mimeType: input.file.mimeType,
          sizeBytes: input.file.sizeBytes,
          sha256: input.file.sha256,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    try {
      await bucket.delete(storageKey);
    } catch {
      // Preserve the original D1 error. The generated asset id and key are in
      // server logs for orphan cleanup if this best-effort rollback also fails.
    }

    throw error;
  }

  return { httpStatus: 201, body: responseData };
}

export async function getImportedAssetSummary(
  db: AppDatabase,
  apiClientId: string,
  externalId: string,
): Promise<Record<string, unknown> | null> {
  const [asset] = await db
    .select({
      id: assets.id,
      externalId: assets.externalId,
      mimeType: assets.mimeType,
      sizeBytes: assets.sizeBytes,
      sha256: assets.sha256,
      altText: assets.altText,
      accessLevel: assets.accessLevel,
      status: assets.status,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(assets)
    .where(
      and(
        eq(assets.uploadedByApiClientId, apiClientId),
        eq(assets.externalId, externalId),
      ),
    )
    .limit(1);

  return asset
    ? {
        asset_id: asset.id,
        external_id: asset.externalId,
        mime_type: asset.mimeType,
        size_bytes: asset.sizeBytes,
        sha256: asset.sha256,
        alt_text: asset.altText,
        access_level: asset.accessLevel,
        status: asset.status,
        url: `/media/${asset.id}`,
        created_at: asset.createdAt.toISOString(),
        updated_at: asset.updatedAt.toISOString(),
      }
    : null;
}
