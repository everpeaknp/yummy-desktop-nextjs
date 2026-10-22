import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  listCampaigns: vi.fn(),
  getSmsWallet: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { role: "admin", restaurant_id: 52, restaurant_name: "The Ivory" } }),
}));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/api/growth", () => ({ growthApi: mocks }));

import { GrowthOverviewClient } from "./growth-overview-client";

const opportunity = (id: number) => ({
  id: "op-" + id,
  playbook_code: "custom",
  title: "Opportunity " + id,
  explanation: "Details for opportunity " + id + ".",
  eligible_customer_count: 4,
  email_eligible_customer_count: 3,
  sms_eligible_customer_count: 1,
  estimated_sms_credits: 1,
});

describe("GrowthOverviewClient layout", () => {
  beforeEach(() => {
    mocks.getOverview.mockResolvedValue({
      summary: { consented_customer_count: 5, identified_customer_count: 8 },
      readiness: { domains: [] },
      opportunities: [1, 2, 3, 4, 5, 6].map(opportunity),
      recent_results: [],
    });
    mocks.listCampaigns.mockResolvedValue([]);
    mocks.getSmsWallet.mockResolvedValue({ available_credits: 4 });
    mocks.getSettings.mockResolvedValue({ email_enabled: true, sms_enabled: true });
  });
  afterEach(() => cleanup());

  it("puts the next action first and reveals additional ideas only on request", async () => {
    const user = userEvent.setup();
    render(<GrowthOverviewClient />);

    expect(await screen.findByRole("heading", { name: "Opportunity 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Other campaign ideas" })).toBeInTheDocument();
    expect(screen.getByText("Opportunity 2")).toBeInTheDocument();
    expect(screen.getByText("Opportunity 3")).toBeInTheDocument();
    expect(screen.queryByText("Opportunity 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show 3 more ideas" }));
    expect(screen.getByText("Opportunity 4")).toBeInTheDocument();
    expect(screen.getByText("Opportunity 6")).toBeInTheDocument();
  });

  it("keeps campaign attention in a full-width section instead of beside a tall suggestion list", async () => {
    render(<GrowthOverviewClient />);

    const attention = await screen.findByRole("heading", { name: "Needs Your Attention" });
    expect(attention.closest("section")).toHaveClass("space-y-4");
    expect(attention.closest("section")).not.toHaveClass("xl:grid-cols-[1.35fr_0.65fr]");
  });

  it("offers a compact sign-up QR shortcut in the Grow overview header", async () => {
    render(<GrowthOverviewClient />);

    const shortcut = await screen.findByRole("link", { name: /get sign-up qr/i });
    expect(shortcut).toHaveAttribute(
      "href",
      "/grow/settings#grow-customer-signups",
    );
    expect(shortcut.closest("header")).toBeInTheDocument();
  });
});
