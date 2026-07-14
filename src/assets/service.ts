import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, count, desc, eq, like, or } from "drizzle-orm";

import { createAssetStorageKey, validateImageFile } from "./image";
import { writeAuditLog } from "@/audit/write";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { assets } from "@/db/assets-schema";
import { users } from "@/db/schema";

export const MAX_ALT_TEXT_LENGTH = 300;

export class AssetServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AssetServiceError";
  }
}

export type AssetView = {
  id: string;
  originalFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  altText: string | null;
  status: "active" | "deleted";
  source: "admin" | "api";
  uploadedBy: string | null;
  createdAt: string;
  deletedAt: string | null;
  url: string;
};

export type PublicAssetRecord = {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

function normalizeAltText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";

  if (normalized.length > MAX_ALT_TEXT_LENGTH) {
    throw new AssetServiceError(
      "ALT_TEXT_TOO_LONG",
      `图片说明不能超过 ${MAX_ALT_TEXT_LENGTH} 个字符`,
      400,
    );
  }

  return normalized || null;
}

function toAssetView(row: {
  id: string;
  originalFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  altText: string | null;
  status: "active" | "deleted";
  source: "admin" | "api";
  uploaderUsername: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}): AssetView {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    extension: row.extension,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    altText: row.altText,
    status: row.status,
    source: row.source,
    uploadedBy: row.uploaderUsername,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    url: `/assets/${row.id}`,
  };
}

export async function getAssetsBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.ASSETS_BUCKET) {
    throw new AssetServiceError(
      "ASSET_STORAGE_UNAVAILABLE",
      "素材存储尚未配置",
      503,
    );
  }

  return env.ASSETS_BUCKET;
}

export async function createAdminAsset(
  db: AppDatabase,
  actorUserId: string,
  file: File,
  altText?: string | null,
): Promise<AssetView> {
  const normalizedAltText = normalizeAltText(altText);
  const image = await validateImageFile(file);
  const now = new Date();
  const assetId = generateId();
  const storageKey = createAssetStorageKey(image.extension, now, assetId);
  const bucket = await getAssetsBucket();

  await bucket.put(storageKey, image.bytes, {
    httpMetadata: {
      contentType: image.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      assetId,
      sha256: image.sha256,
    },
  });

  try {
    await db.insert(assets).values({
      id: assetId,
      originalFilename: image.originalFilename,
      storageKey,
      mimeType: image.mimeType,
      extension: image.extension,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      sha256: image.sha256,
      altText: normalizedAltText,
      source: "admin",
      uploadedByUserId: actorUserId,
      status: "active",
      createdAt: now,
    });
  } catch (error) {
    try {
      await bucket.delete(storageKey);
    } catch (rollbackError) {
      console.error("Failed to roll back an orphaned R2 object", {
        storageKey,
        rollbackError,
      });
    }

    throw error;
  }

  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.asset_uploaded",
    resourceType: "asset",
    resourceId: assetId,
    metadata: {
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      sha256: image.sha256,
    },
  });

  const created = await getAdminAssetById(db, assetId);

  if (!created) {
    throw new AssetServiceError(
      "ASSET_CREATE_FAILED",
      "素材创建后无法读取",
      500,
    );
  }

  return created;
}

export async function listAdminAssets(
  db: AppDatabase,
  input: {
    page: number;
    pageSize: number;
    query?: string;
    status?: "active" | "deleted";
  },
): Promise<{ items: AssetView[]; total: number }> {
  const conditions = [];

  if (input.query) {
    conditions.push(
      or(
        like(assets.originalFilename, `%${input.query}%`),
        like(assets.altText, `%${input.query}%`),
      )!,
    );
  }

  if (input.status) {
    conditions.push(eq(assets.status, input.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db
    .select({ total: count() })
    .from(assets)
    .where(where);
  const rows = await db
    .select({
      id: assets.id,
      originalFilename: assets.originalFilename,
      mimeType: assets.mimeType,
      extension: assets.extension,
      sizeBytes: assets.sizeBytes,
      width: assets.width,
      height: assets.height,
      sha256: assets.sha256,
      altText: assets.altText,
      status: assets.status,
      source: assets.source,
      uploaderUsername: users.username,
      createdAt: assets.createdAt,
      deletedAt: assets.deletedAt,
    })
    .from(assets)
    .leftJoin(users, eq(assets.uploadedByUserId, users.id))
    .where(where)
    .orderBy(desc(assets.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return {
    items: rows.map(toAssetView),
    total,
  };
}

export async function getAdminAssetById(
  db: AppDatabase,
  assetId: string,
): Promise<AssetView | null> {
  const [row] = await db
    .select({
      id: assets.id,
      originalFilename: assets.originalFilename,
      mimeType: assets.mimeType,
      extension: assets.extension,
      sizeBytes: assets.sizeBytes,
      width: assets.width,
      height: assets.height,
      sha256: assets.sha256,
      altText: assets.altText,
      status: assets.status,
      source: assets.source,
      uploaderUsername: users.username,
      createdAt: assets.createdAt,
      deletedAt: assets.deletedAt,
    })
    .from(assets)
    .leftJoin(users, eq(assets.uploadedByUserId, users.id))
    .where(eq(assets.id, assetId))
    .limit(1);

  return row ? toAssetView(row) : null;
}

export async function getPublicAssetRecord(
  db: AppDatabase,
  assetId: string,
): Promise<PublicAssetRecord | null> {
  const row = await db.query.assets.findFirst({
    columns: {
      id: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
    },
    where: and(eq(assets.id, assetId), eq(assets.status, "active")),
  });

  return row ?? null;
}

export async function deleteAdminAsset(
  db: AppDatabase,
  actorUserId: string,
  assetId: string,
): Promise<void> {
  const row = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.status, "active")),
  });

  if (!row) {
    throw new AssetServiceError("ASSET_NOT_FOUND", "素材不存在", 404);
  }

  const now = new Date();
  const bucket = await getAssetsBucket();

  await db
    .update(assets)
    .set({ status: "deleted", deletedAt: now })
    .where(and(eq(assets.id, assetId), eq(assets.status, "active")));

  try {
    await bucket.delete(row.storageKey);
  } catch (error) {
    await db
      .update(assets)
      .set({ status: "active", deletedAt: null })
      .where(eq(assets.id, assetId));
    throw new AssetServiceError(
      "ASSET_DELETE_FAILED",
      "素材存储删除失败，数据库状态已恢复",
      503,
    );
  }

  await writeAuditLog(db, {
    actorType: "user",
    actorId: actorUserId,
    action: "admin.asset_deleted",
    resourceType: "asset",
    resourceId: assetId,
    metadata: {
      storageKey: row.storageKey,
      sha256: row.sha256,
    },
  });
}
