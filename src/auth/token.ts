import { SESSION_TOKEN_BYTES } from "./constants";
import { bytesToBase64Url } from "@/lib/base64url";

const encoder = new TextEncoder();

export function generateOpaqueToken(length = SESSION_TOKEN_BYTES): string {
  if (!Number.isSafeInteger(length) || length < 16) {
    throw new Error("Opaque token length must be at least 16 bytes");
  }

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function generateId(): string {
  return crypto.randomUUID();
}
