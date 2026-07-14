export type MarketEventStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export type EventImportAction = "created" | "updated" | "unchanged";

export function canPublishEvent(status: MarketEventStatus): boolean {
  return (
    status === "draft" ||
    status === "pending_review" ||
    status === "rejected" ||
    status === "archived"
  );
}

export function canArchiveEvent(status: MarketEventStatus): boolean {
  return status === "published";
}

export function decideEventImportAction(
  currentHash: string | null,
  nextHash: string,
): EventImportAction {
  if (currentHash === null) {
    return "created";
  }

  return currentHash === nextHash ? "unchanged" : "updated";
}

export function decideEventImportOutcome(input: {
  action: EventImportAction;
  currentStatus: MarketEventStatus | null;
  reviewMode: "on" | "off";
}): { status: MarketEventStatus; httpStatus: number } {
  if (input.action === "unchanged") {
    return { status: input.currentStatus ?? "draft", httpStatus: 200 };
  }

  if (input.reviewMode === "on") {
    return { status: "pending_review", httpStatus: 202 };
  }

  return {
    status: "published",
    httpStatus: input.action === "created" ? 201 : 200,
  };
}
