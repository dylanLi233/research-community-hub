import { SESSION_TOKEN_BYTES } from "./constants";
import { bytesToBase64Url, constantTimeEqual } from "@/lib/base64url";

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

export async function constantTimeEqualText(
  left: string,
  right: string,
): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);

  return constantTimeEqual(
    new Uint8Array(leftDigest),
    new Uint8Array(rightDigest),
  );
}

export function generateId(): string {
  return crypto.randomUUID();
}
