import { bytesToBase64Url } from "@/lib/base64url";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 20_000;
export const MAX_ORIGINAL_FILENAME_LENGTH = 255;

export type SupportedImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export type ValidatedImage = SupportedImage & {
  bytes: Uint8Array;
  sizeBytes: number;
  sha256: string;
  originalFilename: string;
};

export class AssetValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "AssetValidationError";
  }
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16)
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function parsePng(bytes: Uint8Array): SupportedImage | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value) ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    return null;
  }

  return {
    mimeType: "image/png",
    extension: "png",
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

const jpegSofMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

function parseJpeg(bytes: Uint8Array): SupportedImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (marker === 0xda) {
      break;
    }

    if (offset + 1 >= bytes.length) {
      break;
    }

    const segmentLength = readUint16BE(bytes, offset);

    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }

    if (jpegSofMarkers.has(marker) && segmentLength >= 7) {
      return {
        mimeType: "image/jpeg",
        extension: "jpg",
        height: readUint16BE(bytes, offset + 3),
        width: readUint16BE(bytes, offset + 5),
      };
    }

    offset += segmentLength;
  }

  throw new AssetValidationError("INVALID_IMAGE", "JPEG 文件缺少有效尺寸信息");
}

function parseWebp(bytes: Uint8Array): SupportedImage | null {
  if (
    bytes.length < 16 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = ascii(bytes, 12, 4);
  let width = 0;
  let height = 0;

  if (chunkType === "VP8X") {
    if (bytes.length < 30) {
      throw new AssetValidationError("INVALID_IMAGE", "WebP Extended 文件头无效");
    }
    width = readUint24LE(bytes, 24) + 1;
    height = readUint24LE(bytes, 27) + 1;
  } else if (chunkType === "VP8L") {
    if (bytes.length < 25 || bytes[20] !== 0x2f) {
      throw new AssetValidationError("INVALID_IMAGE", "WebP Lossless 文件头无效");
    }

    width = 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
    height =
      1 +
      ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
  } else if (chunkType === "VP8 ") {
    if (
      bytes.length < 30 ||
      bytes[23] !== 0x9d ||
      bytes[24] !== 0x01 ||
      bytes[25] !== 0x2a
    ) {
      throw new AssetValidationError("INVALID_IMAGE", "WebP Lossy 文件头无效");
    }

    width = readUint16LE(bytes, 26) & 0x3fff;
    height = readUint16LE(bytes, 28) & 0x3fff;
  } else {
    throw new AssetValidationError("INVALID_IMAGE", "不支持的 WebP 编码格式");
  }

  return {
    mimeType: "image/webp",
    extension: "webp",
    width,
    height,
  };
}

export function inspectImage(bytes: Uint8Array): SupportedImage {
  if (bytes.length === 0) {
    throw new AssetValidationError("EMPTY_FILE", "上传文件不能为空", 400);
  }

  const parsed = parsePng(bytes) ?? parseJpeg(bytes) ?? parseWebp(bytes);

  if (!parsed) {
    throw new AssetValidationError(
      "UNSUPPORTED_IMAGE_TYPE",
      "仅支持 JPEG、PNG 和 WebP 图片",
      415,
    );
  }

  if (
    parsed.width <= 0 ||
    parsed.height <= 0 ||
    parsed.width > MAX_IMAGE_DIMENSION ||
    parsed.height > MAX_IMAGE_DIMENSION
  ) {
    throw new AssetValidationError(
      "INVALID_IMAGE_DIMENSIONS",
      `图片宽高必须在 1–${MAX_IMAGE_DIMENSION} 像素之间`,
    );
  }

  return parsed;
}

export function sanitizeOriginalFilename(filename: string): string {
  const basename = filename
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim();

  return (basename || "image").slice(0, MAX_ORIGINAL_FILENAME_LENGTH);
}

export function createAssetStorageKey(
  extension: SupportedImage["extension"],
  now = new Date(),
  id = crypto.randomUUID(),
): string {
  const year = now.getUTCFullYear().toString().padStart(4, "0");
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `assets/${year}/${month}/${id}.${extension}`;
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AssetValidationError(
      "FILE_TOO_LARGE",
      `图片不能超过 ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
      413,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectImage(bytes);
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));

  return {
    ...inspected,
    bytes,
    sizeBytes: bytes.length,
    sha256: bytesToBase64Url(new Uint8Array(digest)),
    originalFilename: sanitizeOriginalFilename(file.name),
  };
}
