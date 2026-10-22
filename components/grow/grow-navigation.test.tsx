import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/grow", canManage: true }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => route.canManage }));

import { GrowNavigation } from "./grow-navigation";

describe("GrowNavigation", () => {
  beforeEach(() => { route.canManage = true; route.pathname = "/grow"; });
  afterEach(() => cleanup());

  it.each([
    ["/grow", "Overview"],
    ["/grow/campaigns", "Campaigns"],
    ["/grow/campaigns/new", "Campaigns"],
    ["/grow/campaigns/abc", "Campaigns"],
    ["/grow/subscribers", "Customers"],
    ["/grow/settings", "Settings"],
  ])("marks %s as %s", (pathname, activeLabel) => {
    route.pathname = pathname;
    render(<GrowNavigation />);

    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Grow" })).toBeInTheDocument();
  });

  it("uses customer language while preserving the subscribers route", () => {
    route.pathname = "/grow/subscribers";
    render(<GrowNavigation />);

    expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/grow/subscribers");
    expect(screen.queryByRole("link", { name: "Subscribers" })).not.toBeInTheDocument();
  });

  it("keeps the destinations in a compact, scrollable tab row and hides restricted settings", () => {
    route.pathname = "/grow";
    route.canManage = false;
    render(<GrowNavigation />);

    expect(screen.getByRole("navigation", { name: "Grow" }).firstElementChild).toHaveClass("overflow-x-auto", "border-b");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveClass("shrink-0", "min-h-12");
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
