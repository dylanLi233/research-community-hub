import { describe, expect, it } from "vitest";

import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "./password";

const fixedSalt = new Uint8Array([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
]);

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const encoded = await hashPassword("a sufficiently long password", {
      iterations: 1_000,
      salt: fixedSalt,
    });

    await expect(
      verifyPassword("a sufficiently long password", encoded),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(
      false,
    );
  });

  it("uses different salts by default", async () => {
    const first = await hashPassword("same password", { iterations: 1_000 });
    const second = await hashPassword("same password", { iterations: 1_000 });

    expect(first).not.toBe(second);
  });

  it("rejects malformed password hashes", async () => {
    await expect(verifyPassword("password", "not-a-hash")).resolves.toBe(false);
    await expect(
      verifyPassword("password", "pbkdf2-sha256$0$bad$bad"),
    ).resolves.toBe(false);
  });

  it("detects hashes that need a work-factor upgrade", async () => {
    const encoded = await hashPassword("a sufficiently long password", {
      iterations: 1_000,
      salt: fixedSalt,
    });

    expect(passwordHashNeedsUpgrade(encoded)).toBe(true);
  });
});
