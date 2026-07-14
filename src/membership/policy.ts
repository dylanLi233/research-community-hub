export type AccountStatus = "active" | "disabled";
export type StoredMembershipStatus = "active" | "inactive";

export type MembershipInput = {
  accountStatus: AccountStatus;
  membership: {
    status: StoredMembershipStatus;
    startsAt: Date;
    expiresAt: Date | null;
  } | null;
};

export type MembershipState =
  | "none"
  | "account_disabled"
  | "inactive"
  | "upcoming"
  | "active"
  | "expired";

export type MembershipDecision = {
  state: MembershipState;
  hasMemberAccess: boolean;
};

export function evaluateMembership(
  input: MembershipInput,
  now = new Date(),
): MembershipDecision {
  if (input.accountStatus !== "active") {
    return { state: "account_disabled", hasMemberAccess: false };
  }

  if (!input.membership) {
    return { state: "none", hasMemberAccess: false };
  }

  if (input.membership.status !== "active") {
    return { state: "inactive", hasMemberAccess: false };
  }

  if (input.membership.startsAt.getTime() > now.getTime()) {
    return { state: "upcoming", hasMemberAccess: false };
  }

  if (
    input.membership.expiresAt &&
    input.membership.expiresAt.getTime() <= now.getTime()
  ) {
    return { state: "expired", hasMemberAccess: false };
  }

  return { state: "active", hasMemberAccess: true };
}

export function validateMembershipRange(
  startsAt: Date,
  expiresAt: Date | null,
): boolean {
  return !expiresAt || expiresAt.getTime() > startsAt.getTime();
}
