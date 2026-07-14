import { describe, expect, it } from "vitest";

import {
  evaluateMembership,
  validateMembershipRange,
} from "./policy";

describe("membership policy", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("denies access when the account is disabled", () => {
    expect(
      evaluateMembership(
        {
          accountStatus: "disabled",
          membership: {
            status: "active",
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: null,
          },
        },
        now,
      ),
    ).toEqual({ state: "account_disabled", hasMemberAccess: false });
  });

  it("distinguishes missing, inactive, upcoming and expired memberships", () => {
    expect(
      evaluateMembership({ accountStatus: "active", membership: null }, now),
    ).toEqual({ state: "none", hasMemberAccess: false });
    expect(
      evaluateMembership(
        {
          accountStatus: "active",
          membership: {
            status: "inactive",
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: null,
          },
        },
        now,
      ).state,
    ).toBe("inactive");
    expect(
      evaluateMembership(
        {
          accountStatus: "active",
          membership: {
            status: "active",
            startsAt: new Date("2026-08-01T00:00:00.000Z"),
            expiresAt: null,
          },
        },
        now,
      ).state,
    ).toBe("upcoming");
    expect(
      evaluateMembership(
        {
          accountStatus: "active",
          membership: {
            status: "active",
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: new Date("2026-07-14T12:00:00.000Z"),
          },
        },
        now,
      ).state,
    ).toBe("expired");
  });

  it("grants access to active finite and lifetime memberships", () => {
    expect(
      evaluateMembership(
        {
          accountStatus: "active",
          membership: {
            status: "active",
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: new Date("2027-01-01T00:00:00.000Z"),
          },
        },
        now,
      ),
    ).toEqual({ state: "active", hasMemberAccess: true });
    expect(
      evaluateMembership(
        {
          accountStatus: "active",
          membership: {
            status: "active",
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            expiresAt: null,
          },
        },
        now,
      ).hasMemberAccess,
    ).toBe(true);
  });

  it("requires an expiry later than the start", () => {
    const start = new Date("2026-07-14T12:00:00.000Z");
    expect(validateMembershipRange(start, null)).toBe(true);
    expect(
      validateMembershipRange(
        start,
        new Date("2026-07-14T12:00:00.001Z"),
      ),
    ).toBe(true);
    expect(validateMembershipRange(start, start)).toBe(false);
  });
});
