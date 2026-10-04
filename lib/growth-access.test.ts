import { describe, expect, it } from "vitest";

import {
  CANONICAL_ROUTE_GATES,
  getSidebarItemsForRoles,
  isRouteAllowedMulti,
  normalizeRolesForUser,
} from "@/lib/role-permissions";

describe("Yummy Grow access", () => {
  it("uses grow.view as the canonical route permission", () => {
    expect(CANONICAL_ROUTE_GATES.grow).toBe("grow.view");
  });

  it("allows a manager with grow.view to inspect the overview and campaign snapshots", () => {
    const user = { role: "manager", permissions: ["grow.view"] };
    expect(isRouteAllowedMulti("/grow", user)).toBe(true);
    expect(isRouteAllowedMulti("/grow/campaigns", user)).toBe(true);
    expect(isRouteAllowedMulti("/grow/campaigns/7", user)).toBe(true);
    expect(isRouteAllowedMulti("/grow/campaigns/new", user)).toBe(false);
  });

  it("requires campaign management permission for Campaign Studio", () => {
    const user = {
      role: "manager",
      permissions: ["grow.view", "grow.campaigns.manage"],
    };
    expect(isRouteAllowedMulti("/grow/campaigns/new", user)).toBe(true);
  });

  it("lets an approver inspect campaigns without granting draft management", () => {
    const user = {
      role: "manager",
      permissions: ["grow.view", "grow.campaigns.approve"],
    };
    expect(isRouteAllowedMulti("/grow/campaigns/22", user)).toBe(true);
    expect(isRouteAllowedMulti("/grow/campaigns/new", user)).toBe(false);
  });

  it("denies a manager without grow.view", () => {
    const user = { role: "manager", permissions: ["dashboard.view"] };
    expect(isRouteAllowedMulti("/grow", user)).toBe(false);
  });

  it("only exposes the Grow navigation item when permission is present", () => {
    const allowedUser = { role: "manager", permissions: ["grow.view"] };
    const deniedUser = { role: "manager", permissions: ["dashboard.view"] };

    expect(
      getSidebarItemsForRoles(normalizeRolesForUser(allowedUser), allowedUser).some(
        (item) => item.href === "/grow",
      ),
    ).toBe(true);
    expect(
      getSidebarItemsForRoles(normalizeRolesForUser(deniedUser), deniedUser).some(
        (item) => item.href === "/grow",
      ),
    ).toBe(false);
  });
});
