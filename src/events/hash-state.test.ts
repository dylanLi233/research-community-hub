import { describe, expect, it } from "vitest";

import { hashEventContent, type EventHashInput } from "./hash";
import {
  canArchiveEvent,
  canPublishEvent,
  decideEventImportAction,
  decideEventImportOutcome,
} from "./state";

const event: EventHashInput = {
  title: "美国 CPI",
  eventDate: "2026-08-12",
  startsAt: new Date("2026-08-12T08:30:00-04:00"),
  endsAt: null,
  timezone: "America/New_York",
  allDay: false,
  category: "economic_data",
  importance: "high",
  region: "美国",
  summary: "美国公布 7 月 CPI。",
  impact: "影响降息预期。",
  focusPoints: ["核心 CPI", "服务通胀"],
  sourceName: "BLS",
  sourceUrl: "https://www.bls.gov/",
  tags: ["通胀", "美联储"],
  accessLevel: "public",
};

describe("market event content hash", () => {
  it("is stable and changes with meaningful content", async () => {
    const first = await hashEventContent(event);
    const second = await hashEventContent({ ...event });
    const changed = await hashEventContent({
      ...event,
      importance: "medium",
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });
});

describe("market event state policy", () => {
  it("allows expected publish and archive transitions", () => {
    expect(canPublishEvent("draft")).toBe(true);
    expect(canPublishEvent("pending_review")).toBe(true);
    expect(canPublishEvent("rejected")).toBe(true);
    expect(canPublishEvent("archived")).toBe(true);
    expect(canPublishEvent("published")).toBe(false);
    expect(canArchiveEvent("published")).toBe(true);
    expect(canArchiveEvent("draft")).toBe(false);
  });

  it("decides created, updated and unchanged from hashes", () => {
    expect(decideEventImportAction(null, "a")).toBe("created");
    expect(decideEventImportAction("a", "a")).toBe("unchanged");
    expect(decideEventImportAction("a", "b")).toBe("updated");
  });

  it("applies review mode only to changed events", () => {
    expect(
      decideEventImportOutcome({
        action: "created",
        currentStatus: null,
        reviewMode: "on",
      }),
    ).toEqual({ status: "pending_review", httpStatus: 202 });
    expect(
      decideEventImportOutcome({
        action: "updated",
        currentStatus: "published",
        reviewMode: "off",
      }),
    ).toEqual({ status: "published", httpStatus: 200 });
    expect(
      decideEventImportOutcome({
        action: "unchanged",
        currentStatus: "archived",
        reviewMode: "off",
      }),
    ).toEqual({ status: "archived", httpStatus: 200 });
  });
});
