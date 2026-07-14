import {
  ASSET_EXTENSION_BY_MIME,
  MAX_ASSET_BYTES,
  type AssetMimeType,
} from "./constants";

export class AssetValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field = "file",
  ) {
    super(message);
    this.name = "AssetValidationError";
  }
}

export type ValidatedAssetFile = {
  bytes: ArrayBuffer;
  mimeType: AssetMimeType;
  extension: string;
  originalFilename: string;
  sizeBytes: number;
  sha256: string;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectAssetMimeType(bytes: Uint8Array): AssetMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  const isWebp =
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isWebp ? "image/webp" : null;
}

export function normalizeOriginalFilename(
  filename: string,
  extension: string,
): string {
  const cleaned = filename
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);

  return cleaned || `upload.${extension}`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function validateAssetFile(file: File): Promise<ValidatedAssetFile> {
  if (file.size <= 0) {
    throw new AssetValidationError("EMPTY_FILE", "图片文件不能为空", 400);
  }

  if (file.size > MAX_ASSET_BYTES) {
    throw new AssetValidationError(
      "ASSET_TOO_LARGE",
      "图片文件不能超过 10 MB",
      413,
    );
  }

  const bytes = await file.arrayBuffer();
  const mimeType = detectAssetMimeType(new Uint8Array(bytes));

  if (!mimeType) {
    throw new AssetValidationError(
      "UNSUPPORTED_ASSET_TYPE",
      "仅支持 JPEG、PNG 和 WebP 图片",
      415,
    );
  }

  if (file.type && file.type !== mimeType) {
    throw new AssetValidationError(
      "ASSET_MIME_MISMATCH",
      "图片声明的 MIME 与实际文件类型不一致",
      400,
    );
  }

  const extension = ASSET_EXTENSION_BY_MIME[mimeType];

  return {
    bytes,
    mimeType,
    extension,
    originalFilename: normalizeOriginalFilename(file.name, extension),
    sizeBytes: file.size,
    sha256: await sha256Hex(bytes),
  };
}
