import { describe, expect, it } from "vitest";

import {
  AssetValidationError,
  createAssetStorageKey,
  inspectImage,
  sanitizeOriginalFilename,
  validateImageFile,
} from "./image";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([73, 72, 68, 82], 12);
  bytes.set(
    [
      (width >>> 24) & 0xff,
      (width >>> 16) & 0xff,
      (width >>> 8) & 0xff,
      width & 0xff,
      (height >>> 24) & 0xff,
      (height >>> 16) & 0xff,
      (height >>> 8) & 0xff,
      height & 0xff,
    ],
    16,
  );
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([82, 73, 70, 70, 22, 0, 0, 0, 87, 69, 66, 80], 0);
  bytes.set([86, 80, 56, 88, 10, 0, 0, 0], 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes.set(
    [
      encodedWidth & 0xff,
      (encodedWidth >>> 8) & 0xff,
      (encodedWidth >>> 16) & 0xff,
      encodedHeight & 0xff,
      (encodedHeight >>> 8) & 0xff,
      (encodedHeight >>> 16) & 0xff,
    ],
    24,
  );
  return bytes;
}

function webpVp8l(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([82, 73, 70, 70, 17, 0, 0, 0, 87, 69, 66, 80], 0);
  bytes.set([86, 80, 56, 76, 5, 0, 0, 0, 0x2f], 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[21] = encodedWidth & 0xff;
  bytes[22] =
    ((encodedWidth >>> 8) & 0x3f) | ((encodedHeight & 0x03) << 6);
  bytes[23] = (encodedHeight >>> 2) & 0xff;
  bytes[24] = (encodedHeight >>> 10) & 0x0f;
  return bytes;
}

function webpVp8(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([82, 73, 70, 70, 22, 0, 0, 0, 87, 69, 66, 80], 0);
  bytes.set([86, 80, 56, 32, 10, 0, 0, 0], 12);
  bytes.set([0x9d, 0x01, 0x2a], 23);
  bytes[26] = width & 0xff;
  bytes[27] = (width >>> 8) & 0x3f;
  bytes[28] = height & 0xff;
  bytes[29] = (height >>> 8) & 0x3f;
  return bytes;
}

describe("image content inspection", () => {
  it("reads PNG and JPEG dimensions from file bytes", () => {
    expect(inspectImage(png(1200, 800))).toEqual({
      mimeType: "image/png",
      extension: "png",
      width: 1200,
      height: 800,
    });
    expect(inspectImage(jpeg(1920, 1080))).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 1920,
      height: 1080,
    });
  });

  it("supports VP8X, VP8L and VP8 WebP headers", () => {
    expect(inspectImage(webpVp8x(1280, 720))).toMatchObject({
      mimeType: "image/webp",
      width: 1280,
      height: 720,
    });
    expect(inspectImage(webpVp8l(640, 480))).toMatchObject({
      mimeType: "image/webp",
      width: 640,
      height: 480,
    });
    expect(inspectImage(webpVp8(320, 240))).toMatchObject({
      mimeType: "image/webp",
      width: 320,
      height: 240,
    });
  });

  it("rejects empty, GIF, SVG and damaged image data", () => {
    expect(() => inspectImage(new Uint8Array())).toThrow(AssetValidationError);
    expect(() => inspectImage(new TextEncoder().encode("GIF89a"))).toThrow(
      "仅支持 JPEG、PNG 和 WebP 图片",
    );
    expect(() => inspectImage(new TextEncoder().encode("<svg></svg>"))).toThrow(
      "仅支持 JPEG、PNG 和 WebP 图片",
    );
    expect(() => inspectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toThrow(
      "JPEG 文件缺少有效尺寸信息",
    );
  });

  it("rejects zero and excessive dimensions", () => {
    expect(() => inspectImage(png(0, 10))).toThrow(
      "图片宽高必须在 1–20000 像素之间",
    );
    expect(() => inspectImage(png(20_001, 10))).toThrow(
      "图片宽高必须在 1–20000 像素之间",
    );
  });

  it("uses detected content instead of the supplied file extension", async () => {
    const file = new File([png(4, 3)], "misleading.gif", {
      type: "image/gif",
    });
    const result = await validateImageFile(file);

    expect(result.mimeType).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.originalFilename).toBe("misleading.gif");
    expect(result.sha256).toMatch(/^[A-Za-z0-9_-]+$/u);
  });
});

describe("asset names and storage keys", () => {
  it("removes path segments and control characters from original names", () => {
    expect(sanitizeOriginalFilename("../folder\\bad\u0000name.png")).toBe(
      "badname.png",
    );
  });

  it("builds a dated key without the user's filename", () => {
    expect(
      createAssetStorageKey(
        "webp",
        new Date("2026-07-14T12:00:00.000Z"),
        "fixed-id",
      ),
    ).toBe("assets/2026/07/fixed-id.webp");
  });
});
