import { describe, expect, it } from "vitest";

import { canAccessDashboard, homeForRoles } from "@/lib/role-access";

describe("role-based dashboard access", () => {
  it("sends Admin accounts to the Admin dashboard", () => {
    expect(homeForRoles(["admin"], true)).toBe("/admin");
  });

  it("sends Conductor accounts to the Conductor destination", () => {
    expect(homeForRoles(["conductor"], true)).toBe("/conductor");
  });

  it("does not let a Conductor open the Admin dashboard", () => {
    expect(canAccessDashboard(["conductor"], "admin", true)).toBe(false);
  });

  it("blocks inactive staff from either dashboard", () => {
    expect(homeForRoles(["conductor"], false)).toBe("/access-denied");
    expect(canAccessDashboard(["conductor"], "conductor", false)).toBe(false);
  });

  it("denies an account without an assigned role", () => {
    expect(homeForRoles([], true)).toBe("/access-denied");
  });
});