import { generateOpaqueToken, hashOpaqueToken } from "@/auth/token";

export const API_TOKEN_PREFIX = "rch_live_";
const API_TOKEN_RANDOM_BYTES = 32;
const STORED_TOKEN_PREFIX_LENGTH = 16;

export type GeneratedApiToken = {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
};

export async function generateApiToken(): Promise<GeneratedApiToken> {
  const token = `${API_TOKEN_PREFIX}${generateOpaqueToken(API_TOKEN_RANDOM_BYTES)}`;

  return {
    token,
    tokenHash: await hashOpaqueToken(token),
    tokenPrefix: token.slice(0, STORED_TOKEN_PREFIX_LENGTH),
  };
}

export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);

  if (!match) {
    return null;
  }

  const token = match[1];

  if (!token.startsWith(API_TOKEN_PREFIX) || token.length < 40) {
    return null;
  }

  return token;
}
