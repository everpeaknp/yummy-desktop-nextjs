import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSubscribers: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (state: { user: { role: string; restaurant_id: number; restaurant_name: string } }) => unknown) =>
    selector({ user: { role: "admin", restaurant_id: 52, restaurant_name: "The Ivory" } }),
}));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/api/growth", () => ({ growthApi: mocks }));

import { SubscribersClient } from "./subscribers-client";

describe("SubscribersClient responsive customer list", () => {
  beforeEach(() => {
    mocks.getSubscribers.mockResolvedValue([{
      customer_id: 12,
      name: "Asha Rai",
      phone: "+977 9800000000",
      email: "asha@example.com",
      preferred_language: "en",
      whatsapp_subscribed: false,
      email_subscribed: true,
      sms_subscribed: false,
      whatsapp_status: "not_asked",
      email_status: "opted_in",
      sms_status: "opted_out",
      created_at: "2026-10-01T00:00:00Z",
    }]);
  });

  afterEach(() => cleanup());

  it("shows a touch-friendly customer card on mobile and keeps the wide table for desktop", async () => {
    render(<SubscribersClient />);

    const customerCard = await screen.findByRole("article");
    expect(customerCard).toHaveTextContent("Asha Rai");
    expect(customerCard).toHaveTextContent("asha@example.com");
    expect(customerCard).toHaveTextContent("Allowed");
    expect(customerCard).toHaveTextContent("Stopped");
    expect(customerCard.parentElement).toHaveClass("md:hidden");
    expect(screen.getByRole("table").closest(".hidden")).toHaveClass("md:block");
    expect(screen.getAllByRole("button", { name: "Edit" })[0]).toHaveClass("min-h-10");
  });

  it("uses a compact two-column summary on phones and consistent list spacing", async () => {
    render(<SubscribersClient />);

    const summary = await screen.findByRole("region", { name: "Customer reach summary" });
    expect(summary).toHaveClass("grid-cols-2", "lg:grid-cols-4");
    expect(screen.getByText("All customers").parentElement).toHaveClass("p-3");
    expect(screen.getByRole("heading", { name: "Customer list" })).toHaveClass("text-lg");
  });
});
