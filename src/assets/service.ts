import { and, count, desc, eq, type SQL } from "drizzle-orm";

import type { AssetAccessLevel, AssetMimeType } from "./constants";
import { buildAssetStorageKey, storeAssetObject } from "./storage";
import type { ValidatedAssetFile } from "./validation";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { assets } from "@/db/assets-schema";
import { auditLogs } from "@/db/schema";

export type AssetStatus = "active" | "deleted";

export type AssetView = {
  id: string;
  externalId: string | null;
  originalFilename: string;
  mimeType: AssetMimeType;
  sizeBytes: number;
  sha256: string;
  altText: string | null;
  accessLevel: AssetAccessLevel;
  status: AssetStatus;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = AssetView & {
  storageKey: string;
  uploadedByUserId: string | null;
  uploadedByApiClientId: string | null;
};

function toAssetView(row: typeof assets.$inferSelect): AssetView {
  return {
    id: row.id,
    externalId: row.externalId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    altText: row.altText,
    accessLevel: row.accessLevel,
    status: row.status,
    url: `/media/${row.id}`,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAssetRecord(row: typeof assets.$inferSelect): AssetRecord {
  return {
    ...toAssetView(row),
    storageKey: row.storageKey,
    uploadedByUserId: row.uploadedByUserId,
    uploadedByApiClientId: row.uploadedByApiClientId,
  };
}

export async function createAdminAsset(
  db: AppDatabase,
  bucket: R2Bucket,
  input: {
    actorUserId: string;
    file: ValidatedAssetFile;
    accessLevel: AssetAccessLevel;
    altText: string | null;
  },
): Promise<AssetView> {
  const now = new Date();
  const assetId = generateId();
  const storageKey = buildAssetStorageKey(assetId, input.file.extension, now);

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
        externalId: null,
        originalFilename: input.file.originalFilename,
        storageKey,
        mimeType: input.file.mimeType,
        sizeBytes: input.file.sizeBytes,
        sha256: input.file.sha256,
        altText: input.altText,
        accessLevel: input.accessLevel,
        status: "active",
        uploadedByUserId: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "user",
        actorId: input.actorUserId,
        action: "admin.asset_uploaded",
        resourceType: "asset",
        resourceId: assetId,
        metadata: {
          mimeType: input.file.mimeType,
          sizeBytes: input.file.sizeBytes,
          accessLevel: input.accessLevel,
          sha256: input.file.sha256,
        },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    try {
      await bucket.delete(storageKey);
    } catch {
      // The original database error is more useful. R2 orphan cleanup can be
      // completed from logs if this best-effort compensation also fails.
    }

    throw error;
  }

  return {
    id: assetId,
    externalId: null,
    originalFilename: input.file.originalFilename,
    mimeType: input.file.mimeType,
    sizeBytes: input.file.sizeBytes,
    sha256: input.file.sha256,
    altText: input.altText,
    accessLevel: input.accessLevel,
    status: "active",
    url: `/media/${assetId}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function listAdminAssets(
  db: AppDatabase,
  input: {
    page: number;
    pageSize: number;
    accessLevel?: AssetAccessLevel;
    status?: AssetStatus;
  },
): Promise<{ items: AssetView[]; total: number }> {
  const conditions: SQL[] = [];

  if (input.accessLevel) {
    conditions.push(eq(assets.accessLevel, input.accessLevel));
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
    .select()
    .from(assets)
    .where(where)
    .orderBy(desc(assets.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return {
    items: rows.map(toAssetView),
    total,
  };
}

export async function getActiveAssetRecord(
  db: AppDatabase,
  assetId: string,
): Promise<AssetRecord | null> {
  const [row] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.status, "active")))
    .limit(1);

  return row ? toAssetRecord(row) : null;
}
