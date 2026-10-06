import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn(), permissions: [] as string[] }));
vi.mock("@/lib/api-client", () => ({ default: { get: mocks.get } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: any) => select({ user: { restaurant_id: 52, role: "user", permissions: mocks.permissions } }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/menu/category-dialog", () => ({ CategoryDialog: () => null }));
import CategoriesPage from "./page";

describe("menu category access and optional station lookup", () => {
  beforeEach(() => {
    mocks.permissions = ["menu.categories.manage"];
    mocks.get.mockReset();
    mocks.toast.mockReset();
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/stations")) throw { response: { status: 403 } };
      return { data: { status: "success", data: [{ id: 1, name: "Mocktails", station_id: 3 }] } };
    });
  });
  afterEach(cleanup);

  it("shows categories to a category manager without querying unauthorized stations", async () => {
    render(<CategoriesPage />);
    await screen.findByText("Mocktails");
    expect(mocks.get.mock.calls.map(([url]) => url).some((url: string) => url.startsWith("/stations"))).toBe(false);
    expect(screen.getByRole("button", { name: "Edit Mocktails" })).toBeInTheDocument();
    expect(screen.queryByText("Station unavailable")).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps category rows when an authorized optional station lookup fails", async () => {
    mocks.permissions = ["menu.categories.manage", "inventory.stations.view"];
    render(<CategoriesPage />);
    await screen.findByText("Mocktails");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
