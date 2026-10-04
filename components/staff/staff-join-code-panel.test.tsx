import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: mocks }));
vi.mock("@/hooks/use-restaurant", () => ({
  useRestaurant: (selector: (state: { restaurant: { id: number; name: string } }) => unknown) =>
    selector({ restaurant: { id: 52, name: "Yummy" } }),
}));

import { StaffJoinCodePanel } from "./staff-join-code-panel";

describe("StaffJoinCodePanel", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockRejectedValue({
      response: {
        status: 404,
        data: { message: "Restaurant join code has not been generated" },
      },
    });
  });

  afterEach(() => cleanup());

  it("shows the generate action when the restaurant has not created a join code yet", async () => {
    render(<StaffJoinCodePanel canManage />);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Generate join code" }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Join code could not be loaded")).not.toBeInTheDocument();
  });
});
