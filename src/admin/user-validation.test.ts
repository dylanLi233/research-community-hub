import { describe, expect, it } from "vitest";

import {
  createAdminUserSchema,
  resetPasswordSchema,
  updateAdminUserSchema,
  userListQuerySchema,
} from "./user-validation";

describe("admin user validation", () => {
  it("accepts a user with a valid membership range", () => {
    const result = createAdminUserSchema.safeParse({
      username: "member_01",
      password: "a-strong-temporary-password",
      membership: {
        status: "active",
        startsAt: "2026-07-14T12:00:00.000Z",
        expiresAt: "2027-07-14T12:00:00.000Z",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an expiry that is not later than the start", () => {
    const result = createAdminUserSchema.safeParse({
      username: "member_02",
      password: "a-strong-temporary-password",
      membership: {
        status: "active",
        startsAt: "2026-07-14T12:00:00.000Z",
        expiresAt: "2026-07-14T12:00:00.000Z",
      },
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one update field", () => {
    expect(updateAdminUserSchema.safeParse({}).success).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({ displayName: "新的名称" }).success,
    ).toBe(true);
  });

  it("enforces the temporary password length", () => {
    expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(
      false,
    );
  });

  it("bounds pagination values", () => {
    expect(
      userListQuerySchema.safeParse({ page: "1", pageSize: "100" }).success,
    ).toBe(true);
    expect(
      userListQuerySchema.safeParse({ page: "0", pageSize: "101" }).success,
    ).toBe(false);
  });
});
