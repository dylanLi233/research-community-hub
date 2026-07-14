import type { AssetAccessLevel } from "./constants";
import type { MembershipDecision } from "@/membership/policy";

export type AssetViewer = {
  role: "member" | "admin";
  membership: MembershipDecision;
} | null;

export function canAccessAsset(
  accessLevel: AssetAccessLevel,
  viewer: AssetViewer,
): boolean {
  if (accessLevel === "public") {
    return true;
  }

  if (!viewer) {
    return false;
  }

  if (viewer.role === "admin") {
    return true;
  }

  return accessLevel === "member" && viewer.membership.hasMemberAccess;
}
