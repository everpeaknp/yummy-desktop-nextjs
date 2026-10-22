import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), get: vi.fn() }));

const permissions = [
  { key: "pos.view", module: "pos", title: "POS View", description: "View orders" },
  { key: "pos.order.create", module: "pos", title: "Create Order", description: "Take orders" },
  { key: "finance.accounting.view", module: "finance", title: "Accounting View", description: "View accounting" },
];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (state: { user: { role: string }; me: () => void }) => unknown) =>
    selector({ user: { role: "admin" }, me: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ default: { get: mocks.get } }));

import RolesPage from "./page";

afterEach(() => {
  cleanup();
  mocks.get.mockReset();
  mocks.push.mockReset();
});

describe("role template card actions", () => {
  it("places Use template at the right edge of its role card", async () => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url === "/roles/") return { data: { status: "success", data: [] } };
      if (url === "/roles/permissions") return { data: { status: "success", data: permissions } };
      if (url === "/roles/built-in") {
        return { data: { status: "success", data: { waiter: ["pos.view"] } } };
      }
      throw new Error(`Unexpected roles API request: ${url}`);
    });

    render(<RolesPage />);

    const useTemplate = await screen.findByRole("button", {
      name: "Use Service staff template",
    });
    const roleCard = useTemplate.closest(".min-h-14");

    expect(roleCard).not.toBeNull();
    expect(roleCard?.lastElementChild).toContainElement(useTemplate);
  });

  it("selects or clears every permission in one section without affecting other sections", async () => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url === "/roles/") return { data: { status: "success", data: [] } };
      if (url === "/roles/permissions") return { data: { status: "success", data: permissions } };
      if (url === "/roles/built-in") return { data: { status: "success", data: {} } };
      throw new Error(`Unexpected roles API request: ${url}`);
    });

    render(<RolesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Create role" }));
    fireEvent.click(screen.getByRole("button", { name: /Customize access/ }));

    const selectPos = screen.getByRole("checkbox", {
      name: "Select all Point of sale permissions",
    });
    const viewOrders = screen.getByRole("checkbox", { name: /POS View/ });
    const createOrder = screen.getByRole("checkbox", { name: /Create Order/ });
    const accounting = screen.getByRole("checkbox", { name: /Accounting View/ });

    fireEvent.click(selectPos);
    expect(viewOrders).toBeChecked();
    expect(createOrder).toBeChecked();
    expect(accounting).not.toBeChecked();

    fireEvent.click(selectPos);
    expect(viewOrders).not.toBeChecked();
    expect(createOrder).not.toBeChecked();
  });
});
