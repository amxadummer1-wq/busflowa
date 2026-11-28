import { describe, expect, it } from "vitest";

import { canAccessDashboard, homeForRoles } from "@/lib/role-access";

describe("role-based dashboard access", () => {
  it("sends Admin accounts to the Admin dashboard", () => {
    expect(homeForRoles(["admin"], true)).toBe("/admin");
  });

  it("sends Head Admin accounts to the Admin dashboard", () => {
    expect(homeForRoles(["head_admin"], true)).toBe("/admin");
    expect(canAccessDashboard(["head_admin"], "admin", true)).toBe(true);
  });

  it("sends Conductor accounts to the Conductor destination", () => {
    expect(homeForRoles(["conductor"], true)).toBe("/conductor");
  });

  it("does not let a Conductor open the Admin dashboard", () => {
    expect(canAccessDashboard(["conductor"], "admin", true)).toBe(false);
  });

  it("allows an active Conductor to open the Conductor destination", () => {
    expect(canAccessDashboard(["conductor"], "conductor", true)).toBe(true);
  });

  it("blocks inactive staff from either dashboard", () => {
    expect(homeForRoles(["conductor"], false)).toBe("/access-denied");
    expect(canAccessDashboard(["conductor"], "conductor", false)).toBe(false);
  });

  it("denies an account without an assigned role", () => {
    expect(homeForRoles([], true)).toBe("/access-denied");
  });

  it("sends Bus Owners to their own workspace without granting Admin or Conductor access", () => {
    expect(homeForRoles(["bus_owner"], true)).toBe("/owner");
    expect(canAccessDashboard(["bus_owner"], "bus_owner", true)).toBe(true);
    expect(canAccessDashboard(["bus_owner"], "admin", true)).toBe(false);
    expect(canAccessDashboard(["bus_owner"], "conductor", true)).toBe(false);
  });
});