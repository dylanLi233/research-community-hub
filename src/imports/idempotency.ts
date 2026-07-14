import { z } from "zod";

export const MAX_IMPORT_BODY_BYTES = 1024 * 1024;

export class ImportRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ImportRequestError";
  }
}

export function validateIdempotencyKey(value: string | null): string {
  if (!value) {
    throw new ImportRequestError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key 请求头不能为空",
      400,
      "Idempotency-Key",
    );
  }

  if (!/^[\x21-\x7e]{1,200}$/.test(value)) {
    throw new ImportRequestError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key 必须为 1–200 个无空白可打印 ASCII 字符",
      400,
      "Idempotency-Key",
    );
  }

  return value;
}

export function validateClientRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (!z.uuid().safeParse(value).success) {
    throw new ImportRequestError(
      "INVALID_REQUEST_ID",
      "X-Request-Id 必须是 UUID",
      400,
      "X-Request-Id",
    );
  }

  return value;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function hashImportRequest(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(
    typeof value === "string" ? value : stableStringify(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
