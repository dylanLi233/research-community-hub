import { describe, expect, it } from "vitest";

import { removesActiveAdmin } from "./user-service";

describe("active admin safety policy", () => {
  it("detects disabling or demoting an active administrator", () => {
    expect(
      removesActiveAdmin(
        { role: "admin", status: "active" },
        { role: "admin", status: "disabled" },
      ),
    ).toBe(true);
    expect(
      removesActiveAdmin(
        { role: "admin", status: "active" },
        { role: "member", status: "active" },
      ),
    ).toBe(true);
  });

  it("does not block unrelated transitions", () => {
    expect(
      removesActiveAdmin(
        { role: "member", status: "active" },
        { role: "member", status: "disabled" },
      ),
    ).toBe(false);
    expect(
      removesActiveAdmin(
        { role: "admin", status: "active" },
        { role: "admin", status: "active" },
      ),
    ).toBe(false);
  });
});
