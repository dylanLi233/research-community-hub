import { describe, expect, it } from "vitest";

import { MAX_ASSET_BYTES } from "./constants";
import {
  AssetValidationError,
  detectAssetMimeType,
  normalizeOriginalFilename,
  validateAssetFile,
} from "./validation";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const webpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("asset validation", () => {
  it("detects supported image signatures", () => {
    expect(detectAssetMimeType(jpegBytes)).toBe("image/jpeg");
    expect(detectAssetMimeType(pngBytes)).toBe("image/png");
    expect(detectAssetMimeType(webpBytes)).toBe("image/webp");
    expect(detectAssetMimeType(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("normalizes unsafe or empty original filenames", () => {
    expect(normalizeOriginalFilename("  report\u0000.png  ", "png")).toBe(
      "report.png",
    );
    expect(normalizeOriginalFilename("\u0000\u0001", "webp")).toBe(
      "upload.webp",
    );
  });

  it("accepts a valid file and calculates a SHA-256 hash", async () => {
    const result = await validateAssetFile(
      new File([pngBytes], "chart.png", { type: "image/png" }),
    );

    expect(result.mimeType).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.sizeBytes).toBe(pngBytes.byteLength);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a declared MIME that does not match the file signature", async () => {
    await expect(
      validateAssetFile(
        new File([jpegBytes], "fake.png", { type: "image/png" }),
      ),
    ).rejects.toMatchObject<Partial<AssetValidationError>>({
      code: "ASSET_MIME_MISMATCH",
      status: 400,
    });
  });

  it("rejects empty, unsupported and oversized files", async () => {
    await expect(
      validateAssetFile(new File([], "empty.png", { type: "image/png" })),
    ).rejects.toMatchObject({ code: "EMPTY_FILE" });

    await expect(
      validateAssetFile(
        new File([new Uint8Array([1, 2, 3])], "file.bin", {
          type: "application/octet-stream",
        }),
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ASSET_TYPE", status: 415 });

    const oversized = new Uint8Array(MAX_ASSET_BYTES + 1);
    oversized.set(pngBytes);
    await expect(
      validateAssetFile(
        new File([oversized], "large.png", { type: "image/png" }),
      ),
    ).rejects.toMatchObject({ code: "ASSET_TOO_LARGE", status: 413 });
  });
});
