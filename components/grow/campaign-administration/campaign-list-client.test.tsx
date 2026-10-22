import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listCampaigns: vi.fn() }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { role: "admin", restaurant_id: 52 } }),
}));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/api/growth", () => ({ growthApi: mocks }));

import { CampaignListClient } from "./campaign-list-client";

describe("CampaignListClient workflow navigation", () => {
  beforeEach(() => {
    mocks.listCampaigns.mockResolvedValue([]);
    window.history.replaceState(null, "", "/grow/campaigns");
  });
  afterEach(() => cleanup());

  it("uses a compact mobile status selector while keeping desktop campaign tabs", async () => {
    render(<CampaignListClient />);

    const navigation = await screen.findByRole("navigation", { name: "Campaign views" });
    expect(navigation).toHaveClass("hidden", "md:flex");

    for (const label of ["Needs Attention", "Scheduled", "Sent", "Drafts", "All"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }

    expect(screen.getByRole("combobox", { name: "Campaign status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filters/ })).toBeInTheDocument();
  });

  it("opens channel, goal, and sort filters together on mobile", async () => {
    render(<CampaignListClient />);

    await screen.findByPlaceholderText("Search campaigns…");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

    expect(await screen.findByRole("dialog", { name: "Campaign filters" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by channel" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by campaign goal" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort campaigns" })).toBeInTheDocument();
  });
});
