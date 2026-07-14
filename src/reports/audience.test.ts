import { describe, expect, it } from "vitest";

import { decideReportAudience } from "./audience";

describe("report audience decision", () => {
  it("treats missing sessions as visitors", () => {
    expect(
      decideReportAudience({
        sessionRole: null,
        mustChangePassword: false,
        membership: { state: "none", hasMemberAccess: false },
      }),
    ).toEqual({
      audience: "visitor",
      isAuthenticated: false,
      mustChangePassword: false,
      membershipState: "none",
    });
  });

  it("grants full member access only to active memberships", () => {
    expect(
      decideReportAudience({
        sessionRole: "member",
        mustChangePassword: false,
        membership: { state: "active", hasMemberAccess: true },
      }).audience,
    ).toBe("member");

    for (const state of ["none", "inactive", "upcoming", "expired"] as const) {
      expect(
        decideReportAudience({
          sessionRole: "member",
          mustChangePassword: false,
          membership: { state, hasMemberAccess: false },
        }).audience,
      ).toBe("visitor");
    }
  });

  it("grants administrators full member content", () => {
    expect(
      decideReportAudience({
        sessionRole: "admin",
        mustChangePassword: false,
        membership: { state: "none", hasMemberAccess: false },
      }).audience,
    ).toBe("admin");
  });

  it("blocks full content until the initial password is changed", () => {
    expect(
      decideReportAudience({
        sessionRole: "member",
        mustChangePassword: true,
        membership: { state: "active", hasMemberAccess: true },
      }),
    ).toMatchObject({
      audience: "visitor",
      isAuthenticated: true,
      mustChangePassword: true,
    });
  });
});
