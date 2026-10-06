import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), get: vi.fn() }));

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
      if (url === "/roles/permissions") return { data: { status: "success", data: [] } };
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
});
