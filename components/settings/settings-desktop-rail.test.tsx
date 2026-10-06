import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "admin" } }),
}));
vi.mock("@/hooks/use-subscription", () => ({
  useSubscriptionStore: (selector: (state: { current: null }) => unknown) =>
    selector({ current: null }),
}));

import { SettingsDesktopRail } from "./settings-desktop-rail";

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  mocks.push.mockReset();
});

describe("settings navigation rail", () => {
  it("provides a compact settings selector outside the desktop rail breakpoint", () => {
    render(<SettingsDesktopRail activeItemId="roles" />);

    const selector = screen.getByRole("combobox", { name: "Settings section" });
    expect(selector.parentElement).toHaveClass("2xl:hidden");
    expect(selector).toHaveTextContent("Roles & permissions");
  });

  it("routes to the selected settings page from the compact selector", async () => {
    render(<SettingsDesktopRail activeItemId="roles" />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Settings section" }), {
      key: "ArrowDown",
    });
    const option = await screen.findByRole("option", { name: "Business profile" });
    fireEvent.pointerDown(option, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(option, { button: 0, pointerType: "mouse" });

    expect(mocks.push).toHaveBeenCalledWith("/settings/business-profile");
  });

  it("keeps the desktop settings navigation sticky and independently scrollable", () => {
    render(<SettingsDesktopRail activeItemId="roles" />);

    const rail = screen.getByRole("navigation", { name: "Settings" }).parentElement;

    expect(rail?.parentElement).toHaveClass(
      "2xl:sticky",
      "2xl:top-24",
      "2xl:h-[calc(100dvh-7rem)]",
    );
    expect(rail).toHaveClass(
      "h-full",
      "overflow-y-auto",
      "overscroll-contain",
      "sidebar-scroll",
    );
  });
});
