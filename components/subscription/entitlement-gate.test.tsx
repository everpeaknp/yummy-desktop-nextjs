import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  allowed: false,
  canOpenPlans: true,
  error: null as string | null,
  resolved: true,
}));

vi.mock("@/hooks/use-subscription", () => ({
  useEntitlement: () => ({
    allowed: state.allowed,
    loading: false,
    error: state.error,
    resolved: state.resolved,
  }),
  useRequiredPlanName: () => "Enterprise",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (value: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "waiter" } }),
}));

vi.mock("@/lib/role-permissions", () => ({
  isPathAccessible: () => state.canOpenPlans,
  getHomeRouteForUser: () => "/orders",
}));

vi.mock("@/lib/subscription/entitlements", () => ({
  featurePresentation: () => ({
    title: "Hotel module",
    description: "Manage hotel operations alongside your restaurant.",
  }),
}));

import { EntitlementGate } from "@/components/subscription/entitlement-gate";

describe("EntitlementGate", () => {
  beforeEach(() => {
    state.allowed = false;
    state.canOpenPlans = true;
    state.error = null;
    state.resolved = true;
  });
  afterEach(cleanup);

  it("shows a page-level plan unavailable state without a modal", () => {
    render(
      <EntitlementGate entitlement="business.hotel.enabled">
        <p>Hotel workspace</p>
      </EntitlementGate>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /isn.t on your current plan/i })).toBeInTheDocument();
    expect(screen.getByText(/hotel operations alongside your restaurant/i)).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.queryByText("Hotel workspace")).not.toBeInTheDocument();
  });

  it("offers plan information only when the signed-in user can access it", () => {
    const { rerender } = render(
      <EntitlementGate entitlement="business.hotel.enabled">
        <p>Hotel workspace</p>
      </EntitlementGate>,
    );
    expect(screen.getByRole("link", { name: /view available plans/i })).toHaveAttribute("href", "/premium");

    state.canOpenPlans = false;
    rerender(
      <EntitlementGate entitlement="business.hotel.enabled">
        <p>Hotel workspace</p>
      </EntitlementGate>,
    );
    expect(screen.queryByRole("link", { name: /view available plans/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask your administrator to review access/i)).toBeInTheDocument();
  });

  it("renders protected content when the entitlement is enabled", () => {
    state.allowed = true;
    render(
      <EntitlementGate entitlement="business.hotel.enabled">
        <p>Hotel workspace</p>
      </EntitlementGate>,
    );

    expect(screen.getByText("Hotel workspace")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /isn.t on your current plan/i })).not.toBeInTheDocument();
  });

  it("does not expose technical entitlement errors", () => {
    state.error = "AxiosError: Request failed with status code 502";
    state.resolved = false;
    render(
      <EntitlementGate entitlement="business.hotel.enabled">
        <p>Hotel workspace</p>
      </EntitlementGate>,
    );

    expect(screen.getByRole("heading", { name: /couldn.t confirm this feature.s access/i })).toBeInTheDocument();
    expect(screen.queryByText(/AxiosError|502/)).not.toBeInTheDocument();
  });
});
