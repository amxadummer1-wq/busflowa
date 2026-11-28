import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;
export type DashboardPath = "/admin" | "/owner" | "/conductor" | "/access-denied";

export function homeForRoles(roles: readonly AppRole[], isActive: boolean): DashboardPath {
  if (!isActive || roles.length === 0) return "/access-denied";
  if (roles.includes("admin") || roles.includes("head_admin")) return "/admin";
  if (roles.includes("bus_owner")) return "/owner";
  if (roles.includes("conductor")) return "/conductor";
  return "/access-denied";
}

export function canAccessDashboard(
  roles: readonly AppRole[],
  requestedRole: AppRole,
  isActive: boolean,
): boolean {
  if (!isActive) return false;

  const requestedPath: DashboardPath = {
    admin: "/admin",
    head_admin: "/admin",
    bus_owner: "/owner",
    conductor: "/conductor",
  }[requestedRole];
  const hasRequestedRole = requestedRole === "admin"
    ? roles.includes("admin") || roles.includes("head_admin")
    : roles.includes(requestedRole);

  return hasRequestedRole
    && homeForRoles(roles, isActive) === requestedPath;
}