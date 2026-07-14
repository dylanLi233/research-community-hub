import { eq } from "drizzle-orm";

import type { AuthenticatedSession } from "@/auth/session";
import type { ContentAudience } from "@/content/types";
import type { AppDatabase } from "@/db/client";
import { memberships } from "@/db/schema";
import {
  evaluateMembership,
  type MembershipDecision,
  type MembershipState,
} from "@/membership/policy";

export type ReportAudienceContext = {
  audience: ContentAudience;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  membershipState: MembershipState;
};

export function decideReportAudience(input: {
  sessionRole: "member" | "admin" | null;
  mustChangePassword: boolean;
  membership: MembershipDecision;
}): ReportAudienceContext {
  if (!input.sessionRole) {
    return {
      audience: "visitor",
      isAuthenticated: false,
      mustChangePassword: false,
      membershipState: "none",
    };
  }

  if (input.mustChangePassword) {
    return {
      audience: "visitor",
      isAuthenticated: true,
      mustChangePassword: true,
      membershipState: input.membership.state,
    };
  }

  if (input.sessionRole === "admin") {
    return {
      audience: "admin",
      isAuthenticated: true,
      mustChangePassword: false,
      membershipState: input.membership.state,
    };
  }

  return {
    audience: input.membership.hasMemberAccess ? "member" : "visitor",
    isAuthenticated: true,
    mustChangePassword: false,
    membershipState: input.membership.state,
  };
}

export async function resolveReportAudience(
  db: AppDatabase,
  session: AuthenticatedSession | null,
): Promise<ReportAudienceContext> {
  if (!session) {
    return decideReportAudience({
      sessionRole: null,
      mustChangePassword: false,
      membership: { state: "none", hasMemberAccess: false },
    });
  }

  if (session.user.role === "admin") {
    return decideReportAudience({
      sessionRole: "admin",
      mustChangePassword: session.user.mustChangePassword,
      membership: { state: "none", hasMemberAccess: false },
    });
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, session.user.id),
  });
  const decision = evaluateMembership({
    accountStatus: "active",
    membership: membership
      ? {
          status: membership.status,
          startsAt: membership.startsAt,
          expiresAt: membership.expiresAt,
        }
      : null,
  });

  return decideReportAudience({
    sessionRole: "member",
    mustChangePassword: session.user.mustChangePassword,
    membership: decision,
  });
}
