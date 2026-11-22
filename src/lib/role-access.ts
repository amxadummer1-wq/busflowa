export type AppRole = "admin" | "conductor";
export type DashboardPath = "/admin" | "/conductor" | "/access-denied";

export function homeForRoles(roles: readonly AppRole[], isActive: boolean): DashboardPath {
  if (!isActive || roles.length === 0) return "/access-denied";
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("conductor")) return "/conductor";
  return "/access-denied";
}

export function canAccessDashboard(
  roles: readonly AppRole[],
  requestedRole: AppRole,
  isActive: boolean,
): boolean {
  const requestedPath = requestedRole === "admin" ? "/admin" : "/conductor";
  return isActive && roles.includes(requestedRole) && homeForRoles(roles, isActive) === requestedPath;
}