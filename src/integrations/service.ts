import {
  and,
  count,
  desc,
  eq,
  like,
  ne,
  type SQL,
} from "drizzle-orm";

import type { ApiClientScope } from "./scopes";
import { generateApiToken } from "./token";
import type {
  ApiClientListQueryInput,
  CreateApiClientInput,
  CreateApiTokenInput,
  UpdateApiClientInput,
} from "./validation";
import { generateId } from "@/auth/token";
import type { AppDatabase } from "@/db/client";
import { apiClients, apiTokens, auditLogs } from "@/db/schema";
import type { ApiErrorDetail } from "@/lib/api-response";

export class IntegrationServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "IntegrationServiceError";
  }
}

export type ApiClientView = {
  id: string;
  name: string;
  status: "active" | "disabled";
  scopes: ApiClientScope[];
  createdAt: string;
  updatedAt: string;
};

export type ApiTokenView = {
  id: string;
  tokenPrefix: string;
  status: "active" | "revoked";
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

function toClientView(row: typeof apiClients.$inferSelect): ApiClientView {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    scopes: row.scopes as ApiClientScope[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTokenView(row: typeof apiTokens.$inferSelect): ApiTokenView {
  return {
    id: row.id,
    tokenPrefix: row.tokenPrefix,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

async function ensureClientNameAvailable(
  db: AppDatabase,
  name: string,
  excludingClientId?: string,
): Promise<void> {
  const conditions: SQL[] = [eq(apiClients.name, name)];

  if (excludingClientId) {
    conditions.push(ne(apiClients.id, excludingClientId));
  }

  const existing = await db
    .select({ id: apiClients.id })
    .from(apiClients)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new IntegrationServiceError(
      "API_CLIENT_NAME_CONFLICT",
      "API Client 名称已被使用",
      409,
      [
        {
          field: "name",
          code: "API_CLIENT_NAME_CONFLICT",
          message: "API Client 名称必须唯一",
        },
      ],
    );
  }
}

async function getClientRow(
  db: AppDatabase,
  clientId: string,
): Promise<typeof apiClients.$inferSelect> {
  const [client] = await db
    .select()
    .from(apiClients)
    .where(eq(apiClients.id, clientId))
    .limit(1);

  if (!client) {
    throw new IntegrationServiceError(
      "API_CLIENT_NOT_FOUND",
      "API Client 不存在",
      404,
    );
  }

  return client;
}

export async function listApiClients(
  db: AppDatabase,
  input: ApiClientListQueryInput,
): Promise<{ items: ApiClientView[]; total: number }> {
  const conditions: SQL[] = [];

  if (input.query) {
    conditions.push(like(apiClients.name, `%${input.query}%`));
  }

  if (input.status) {
    conditions.push(eq(apiClients.status, input.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db
    .select({ total: count() })
    .from(apiClients)
    .where(where);
  const rows = await db
    .select()
    .from(apiClients)
    .where(where)
    .orderBy(desc(apiClients.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return { items: rows.map(toClientView), total };
}

export async function getApiClient(
  db: AppDatabase,
  clientId: string,
): Promise<ApiClientView> {
  return toClientView(await getClientRow(db, clientId));
}

export async function createApiClient(
  db: AppDatabase,
  actorUserId: string,
  input: CreateApiClientInput,
): Promise<ApiClientView> {
  await ensureClientNameAvailable(db, input.name);
  const now = new Date();
  const clientId = generateId();

  await db.batch([
    db.insert(apiClients).values({
      id: clientId,
      name: input.name,
      status: "active",
      scopes: input.scopes,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.api_client_created",
      resourceType: "api_client",
      resourceId: clientId,
      metadata: { name: input.name, scopes: input.scopes },
      createdAt: now,
    }),
  ]);

  return getApiClient(db, clientId);
}

export async function updateApiClient(
  db: AppDatabase,
  actorUserId: string,
  clientId: string,
  input: UpdateApiClientInput,
): Promise<ApiClientView> {
  const current = await getClientRow(db, clientId);

  if (input.name && input.name !== current.name) {
    await ensureClientNameAvailable(db, input.name, clientId);
  }

  const now = new Date();
  await db.batch([
    db
      .update(apiClients)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
        updatedAt: now,
      })
      .where(eq(apiClients.id, clientId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.api_client_updated",
      resourceType: "api_client",
      resourceId: clientId,
      metadata: {
        changedFields: Object.keys(input),
        previousStatus: current.status,
      },
      createdAt: now,
    }),
  ]);

  return getApiClient(db, clientId);
}

export async function listApiTokens(
  db: AppDatabase,
  clientId: string,
): Promise<ApiTokenView[]> {
  await getClientRow(db, clientId);
  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.clientId, clientId))
    .orderBy(desc(apiTokens.createdAt));

  return rows.map(toTokenView);
}

export async function createApiToken(
  db: AppDatabase,
  actorUserId: string,
  clientId: string,
  input: CreateApiTokenInput,
): Promise<{ token: string; metadata: ApiTokenView }> {
  await getClientRow(db, clientId);
  const now = new Date();
  const expiresAt = input.expiresAt ?? null;

  if (expiresAt && expiresAt <= now) {
    throw new IntegrationServiceError(
      "INVALID_TOKEN_EXPIRY",
      "Token 到期时间必须晚于当前时间",
      422,
      [
        {
          field: "expiresAt",
          code: "INVALID_TOKEN_EXPIRY",
          message: "Token 到期时间必须晚于当前时间",
        },
      ],
    );
  }

  const generated = await generateApiToken();
  const tokenId = generateId();

  await db.batch([
    db.insert(apiTokens).values({
      id: tokenId,
      clientId,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      status: "active",
      expiresAt,
      createdAt: now,
    }),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.api_token_created",
      resourceType: "api_token",
      resourceId: tokenId,
      metadata: {
        clientId,
        tokenPrefix: generated.tokenPrefix,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      createdAt: now,
    }),
  ]);

  const [row] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .limit(1);

  if (!row) {
    throw new IntegrationServiceError(
      "API_TOKEN_CREATE_FAILED",
      "Token 创建后无法读取",
      500,
    );
  }

  return { token: generated.token, metadata: toTokenView(row) };
}

export async function revokeApiToken(
  db: AppDatabase,
  actorUserId: string,
  clientId: string,
  tokenId: string,
): Promise<ApiTokenView> {
  await getClientRow(db, clientId);
  const [token] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.clientId, clientId)))
    .limit(1);

  if (!token) {
    throw new IntegrationServiceError(
      "API_TOKEN_NOT_FOUND",
      "API Token 不存在",
      404,
    );
  }

  if (token.status === "revoked") {
    return toTokenView(token);
  }

  const now = new Date();
  await db.batch([
    db
      .update(apiTokens)
      .set({ status: "revoked", revokedAt: now })
      .where(eq(apiTokens.id, tokenId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.api_token_revoked",
      resourceType: "api_token",
      resourceId: tokenId,
      metadata: { clientId, tokenPrefix: token.tokenPrefix },
      createdAt: now,
    }),
  ]);

  const [updated] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .limit(1);

  return toTokenView(updated!);
}
