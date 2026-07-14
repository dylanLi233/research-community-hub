import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  normalizeUsername,
  safeReturnTo,
  usernameSchema,
} from "./validation";

describe("authentication validation", () => {
  it("normalizes case and compatibility characters in usernames", () => {
    expect(normalizeUsername("  Ｄylan.LI  ")).toBe("dylan.li");
  });

  it("accepts Unicode usernames and rejects spaces", () => {
    expect(usernameSchema.safeParse("小八_01").success).toBe(true);
    expect(usernameSchema.safeParse("bad name").success).toBe(false);
  });

  it("only allows same-site return paths", () => {
    expect(safeReturnTo("/reports?page=2#latest")).toBe(
      "/reports?page=2#latest",
    );
    expect(safeReturnTo("https://evil.example/path")).toBe("/");
    expect(safeReturnTo("//evil.example/path")).toBe("/");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("rejects short or unchanged new passwords", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password",
        newPassword: "short",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "same-password-123",
        newPassword: "same-password-123",
      }).success,
    ).toBe(false);
  });
});
