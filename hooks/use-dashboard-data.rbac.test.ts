import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: { get } }));
vi.mock("@/hooks/use-restaurant", () => ({
  useRestaurant: (select: any) => select({ restaurant: { restaurant_enabled: true } }),
}));

import { useDashboardData } from "@/hooks/use-dashboard-data";

describe("dashboard optional data permissions", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(async (url: string) => ({
      data: { status: "success", data: url === "/users/all" ? [{ id: 505, name: "Test staff" }] : [] },
    }));
  });
  afterEach(cleanup);

  const user = (permissions: string[]) => ({ role: "user", restaurant_id: 52, permissions });

  it("loads Casey's dashboard without requesting an unauthorized staff roster", async () => {
    const { result } = renderHook(() => useDashboardData(user(["dashboard.view", "tables.view", "menu.view"]), "today", undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(get.mock.calls.map(([url]) => url)).not.toContain("/users/all");
    expect(result.current.staff).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("skips all optional catalogs for a dashboard-only custom user", async () => {
    const { result } = renderHook(() => useDashboardData(user(["dashboard.view"]), "today", undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toContain("/admin/dashboard/v2");
  });

  it("fetches and clears staff when the grant is added then removed", async () => {
    const { result, rerender } = renderHook(({ permissions }) => useDashboardData(user(permissions), "today", undefined), {
      initialProps: { permissions: ["dashboard.view", "admin.staff.view"] },
    });
    await waitFor(() => expect(result.current.staff).toHaveLength(1));
    get.mockClear();
    rerender({ permissions: ["dashboard.view"] });
    await waitFor(() => expect(result.current.staff).toEqual([]));
    expect(get.mock.calls.map(([url]) => url)).not.toContain("/users/all");
  });

  it("ignores an old staff request that completes after access is revoked", async () => {
    let finishStaff!: (response: any) => void;
    get.mockImplementation((url: string) => url === "/users/all"
      ? new Promise((resolve) => { finishStaff = resolve; })
      : Promise.resolve({ data: { status: "success", data: [] } }));
    const { result, rerender } = renderHook(({ permissions }) => useDashboardData(user(permissions), "today", undefined), {
      initialProps: { permissions: ["dashboard.view", "admin.staff.view"] },
    });
    rerender({ permissions: ["dashboard.view"] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => finishStaff({ data: { status: "success", data: [{ id: 10, name: "Restricted staff" }] } }));
    expect(result.current.staff).toEqual([]);
  });
});
