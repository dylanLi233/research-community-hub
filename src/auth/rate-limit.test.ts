import { describe, expect, it } from "vitest";

import {
  evaluateLoginRateLimit,
  nextLoginFailureState,
  type LoginRateState,
} from "./rate-limit";
import { LOGIN_BLOCK_MS, LOGIN_MAX_FAILURES } from "./constants";

describe("login rate-limit policy", () => {
  const start = new Date("2026-07-14T00:00:00.000Z");

  it("increments failures inside one window", () => {
    const first = nextLoginFailureState(null, start);
    const second = nextLoginFailureState(
      first,
      new Date(start.getTime() + 1_000),
    );

    expect(first.failureCount).toBe(1);
    expect(second.failureCount).toBe(2);
    expect(second.windowStartedAt).toEqual(start);
  });

  it("blocks after the configured threshold", () => {
    let state: LoginRateState | null = null;

    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      state = nextLoginFailureState(
        state,
        new Date(start.getTime() + index * 1_000),
      );
    }

    if (!state) {
      throw new Error("Expected a rate-limit state after login failures");
    }

    expect(state.blockedUntil).toEqual(
      new Date(start.getTime() + (LOGIN_MAX_FAILURES - 1) * 1_000 + LOGIN_BLOCK_MS),
    );
    expect(
      evaluateLoginRateLimit(
        state,
        new Date(start.getTime() + LOGIN_MAX_FAILURES * 1_000),
      ).blocked,
    ).toBe(true);
  });

  it("allows login after a block expires", () => {
    const state = {
      failureCount: LOGIN_MAX_FAILURES,
      windowStartedAt: start,
      blockedUntil: new Date(start.getTime() + LOGIN_BLOCK_MS),
    };

    expect(
      evaluateLoginRateLimit(
        state,
        new Date(start.getTime() + LOGIN_BLOCK_MS + 1),
      ),
    ).toEqual({ blocked: false, retryAfterSeconds: null });
  });
});
