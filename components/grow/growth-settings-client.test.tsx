import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getSmsWallet: vi.fn(),
  getSmsPackages: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { role: "admin", restaurant_id: 52, restaurant_name: "The Ivory" } }),
}));
vi.mock("@/hooks/use-restaurant", () => ({
  useRestaurant: (selector: (state: { restaurant: { name: string }; fetchRestaurant: () => void }) => unknown) => selector({ restaurant: { name: "The Ivory" }, fetchRestaurant: vi.fn() }),
}));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/api/growth", () => ({ growthApi: mocks }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));

import { GrowthSettingsClient } from "./growth-settings-client";

describe("GrowthSettingsClient layout", () => {
  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({
      restaurant_id: 52,
      new_customer_lookback_days: 30,
      regular_min_completed_orders: 3,
      lapsed_after_days: 60,
      promotion_frequency_cap_days: 7,
      quiet_hours_start: "21:00:00",
      quiet_hours_end: "08:00:00",
      approved_languages: ["en"],
      whatsapp_enabled: false,
      email_enabled: true,
      sms_enabled: true,
      ai_copy_enabled: true,
      public_enrollment_enabled: true,
      consent_policy_version: "1",
      consent_text: "Customers choose whether to receive offers.",
      consent_text_hash: "hash",
    });
    mocks.getSmsWallet.mockResolvedValue({ restaurant_id: 52, available_credits: 120, reserved_credits: 10, currency: "NPR" });
    mocks.getSmsPackages.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("organizes settings into task-focused sections with a restaurant-friendly heading", async () => {
    render(<GrowthSettingsClient />);

    expect(await screen.findByRole("heading", { name: "Grow settings" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Campaign delivery" })).toBeInTheDocument());
    for (const heading of ["Customer sign-ups", "Customer reach", "SMS credits", "Consent policy"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(await screen.findByRole("button", { name: "Preview signup sign" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer sign-ups" }).closest("[id='grow-customer-signups']")).toHaveClass("lg:col-span-2");
    expect(screen.getByRole("group", { name: "Customer sign-up controls" })).toHaveClass("max-w-5xl");
    expect(screen.getByRole("group", { name: "Sign-up link" })).toHaveClass("sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(screen.getByRole("group", { name: "Sign-up QR actions" })).toHaveClass("flex", "flex-wrap");
    expect(screen.getByRole("navigation", { name: "Grow settings sections" })).toHaveClass("grid-cols-2", "sm:grid-cols-3", "lg:grid-cols-5");
    expect(screen.getByRole("region", { name: "Campaign delivery" })).toHaveClass("lg:col-span-2");
  });
});
