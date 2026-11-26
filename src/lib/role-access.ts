export type AppRole = "admin" | "conductor" | "head_admin" | "bus_owner";
export type DashboardPath = "/admin" | "/conductor" | "/access-denied";

export function homeForRoles(roles: readonly AppRole[], isActive: boolean): DashboardPath {
  if (!isActive || roles.length === 0) return "/access-denied";
  if (roles.includes("admin") || roles.includes("head_admin")) return "/admin";
  if (roles.includes("conductor")) return "/conductor";
  return "/access-denied";
}

export function canAccessDashboard(
  roles: readonly AppRole[],
  requestedRole: AppRole,
  isActive: boolean,
): boolean {
  if (!isActive) return false;

  const requestedPath = requestedRole === "conductor"
    ? "/conductor"
    : requestedRole === "bus_owner"
      ? "/access-denied"
      : "/admin";
  const hasRequestedRole = requestedRole === "admin"
    ? roles.includes("admin") || roles.includes("head_admin")
    : roles.includes(requestedRole);

  return requestedPath !== "/access-denied"
    && hasRequestedRole
    && homeForRoles(roles, isActive) === requestedPath;
}