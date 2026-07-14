import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { hasApiClientScope, type ApiClientScope } from "./scopes";
import { parseBearerToken } from "./token";
import { hashOpaqueToken } from "@/auth/token";
import { getDb, type AppDatabase } from "@/db/client";
import { apiClients, apiTokens } from "@/db/schema";
import { apiError } from "@/lib/api-response";

export type ApiCredentialDecision = "valid" | "invalid" | "scope_denied";

export function evaluateApiCredential(input: {
  clientStatus: "active" | "disabled";
  tokenStatus: "active" | "revoked";
  expiresAt: Date | null;
  scopes: readonly string[];
  requiredScope: ApiClientScope;
  now?: Date;
}): ApiCredentialDecision {
  const now = input.now ?? new Date();

  if (
    input.clientStatus !== "active" ||
    input.tokenStatus !== "active" ||
    (input.expiresAt !== null && input.expiresAt <= now)
  ) {
    return "invalid";
  }

  return hasApiClientScope(input.scopes, input.requiredScope)
    ? "valid"
    : "scope_denied";
}

export type AuthenticatedApiClient = {
  db: AppDatabase;
  client: {
    id: string;
    name: string;
    scopes: ApiClientScope[];
  };
  token: {
    id: string;
    prefix: string;
  };
};

export async function requireApiClientRequest(
  request: NextRequest,
  requiredScope: ApiClientScope,
): Promise<AuthenticatedApiClient | { response: ReturnType<typeof apiError> }> {
  const rawToken = parseBearerToken(request.headers.get("authorization"));

  if (!rawToken) {
    return {
      response: apiError("API_TOKEN_INVALID", "API Token 无效", 401),
    };
  }

  const db = await getDb();
  const tokenHash = await hashOpaqueToken(rawToken);
  const [credential] = await db
    .select({
      tokenId: apiTokens.id,
      tokenPrefix: apiTokens.tokenPrefix,
      tokenStatus: apiTokens.status,
      expiresAt: apiTokens.expiresAt,
      clientId: apiClients.id,
      clientName: apiClients.name,
      clientStatus: apiClients.status,
      scopes: apiClients.scopes,
    })
    .from(apiTokens)
    .innerJoin(apiClients, eq(apiTokens.clientId, apiClients.id))
    .where(and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.clientId, apiClients.id)))
    .limit(1);

  if (!credential) {
    return {
      response: apiError("API_TOKEN_INVALID", "API Token 无效", 401),
    };
  }

  const decision = evaluateApiCredential({
    clientStatus: credential.clientStatus,
    tokenStatus: credential.tokenStatus,
    expiresAt: credential.expiresAt,
    scopes: credential.scopes,
    requiredScope,
  });

  if (decision === "invalid") {
    return {
      response: apiError("API_TOKEN_INVALID", "API Token 无效", 401),
    };
  }

  if (decision === "scope_denied") {
    return {
      response: apiError("SCOPE_DENIED", "API Token 缺少所需权限", 403),
    };
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, credential.tokenId));

  return {
    db,
    client: {
      id: credential.clientId,
      name: credential.clientName,
      scopes: credential.scopes as ApiClientScope[],
    },
    token: {
      id: credential.tokenId,
      prefix: credential.tokenPrefix,
    },
  };
}
