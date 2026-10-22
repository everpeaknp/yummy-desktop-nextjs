import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { hotel, get } = vi.hoisted(() => ({
  hotel: { getSettings: vi.fn(), listRoomTypes: vi.fn(), listRooms: vi.fn(), listFloors: vi.fn(), listRatePlans: vi.fn(), listBuildings: vi.fn() },
  get: vi.fn(),
}));
vi.mock("@/lib/hotel/api", () => ({ hotelPmsApi: hotel }));
vi.mock("@/lib/api-client", () => ({ default: { get } }));
import { useHotelSetupReadiness } from "./use-hotel-setup-readiness";
const settings = { default_checkin_time: "14:00:00", default_checkout_time: "11:00:00", currency: "NPR", allow_overbooking: false, require_clean_room_for_checkin: true };
const member = { id: 1, name: "Front desk", roles: ["custom"], business_scope: "hotel", permissions: ["hotel.view", "hotel.checkin", "pos.view"] };

describe("useHotelSetupReadiness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hotel.getSettings.mockResolvedValue(settings);
    hotel.listRoomTypes.mockResolvedValue([{ id: 1, is_active: true, base_rate: "100" }]);
    hotel.listRooms.mockResolvedValue([{ id: 1, room_type_id: 1, is_active: true }]);
    hotel.listFloors.mockResolvedValue([]);
    hotel.listRatePlans.mockResolvedValue([]);
    get.mockResolvedValue({ data: { status: "success", data: [member, { id: 2, name: "Restaurant", permissions: ["pos.view"] }, { id: 3, name: "Misleading role", roles: ["hotel_manager"], permissions: [] }] } });
  });
  afterEach(cleanup);
  it("loads existing Hotel data and filters staff by effective Hotel permission keys", async () => {
    const { result } = renderHook(() => useHotelSetupReadiness(52, true));
    expect(result.current.status).toBe("loading");
    expect(result.current.readiness).toBeNull();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(result.current.teamStatus).toBe("ready"));
    expect(result.current.readiness?.operationalReady).toBe(true);
    expect(result.current.hotelTeam).toEqual([member]);
    for (const method of [hotel.getSettings, hotel.listRoomTypes, hotel.listRooms, hotel.listFloors, hotel.listRatePlans]) expect(method).toHaveBeenCalledWith(52);
    expect(hotel.listBuildings).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith("/users/all");
  });
  it("does not request staff without permission", async () => {
    const { result } = renderHook(() => useHotelSetupReadiness(52, false));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.teamStatus).toBe("forbidden");
    expect(result.current.hotelTeam).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
  it("hands off a staff 403 without failing Hotel readiness", async () => {
    get.mockRejectedValue({ response: { status: 403 } });
    const { result } = renderHook(() => useHotelSetupReadiness(52, true));
    await waitFor(() => expect(result.current.teamStatus).toBe("forbidden"));
    expect(result.current.status).toBe("ready");
    expect(result.current.readiness?.operationalReady).toBe(true);
  });
  it("keeps staff network failure separate and supports retry", async () => {
    get.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useHotelSetupReadiness(52, true));
    await waitFor(() => expect(result.current.teamStatus).toBe("error"));
    expect(result.current.status).toBe("ready");
    await act(async () => result.current.reload());
    expect(result.current.teamStatus).toBe("ready");
    expect(result.current.hotelTeam).toEqual([member]);
  });
  it("reports core Hotel failures without mislabeling missing setup and supports retry", async () => {
    hotel.listRooms.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useHotelSetupReadiness(52, true));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.readiness).toBeNull();
    await act(async () => result.current.reload());
    expect(result.current.status).toBe("ready");
    expect(result.current.readiness?.operationalReady).toBe(true);
  });
  it("does not wait for staff to establish core Hotel readiness", async () => {
    get.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHotelSetupReadiness(52, true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.teamStatus).toBe("loading");
  });
  it("ignores a staff response received after staff access is revoked", async () => {
    let finish!: (value: unknown) => void;
    get.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ canView }) => useHotelSetupReadiness(52, canView), { initialProps: { canView: true } });
    rerender({ canView: false });
    await waitFor(() => expect(result.current.teamStatus).toBe("forbidden"));
    await act(async () => finish({ data: { status: "success", data: [member] } }));
    expect(result.current.hotelTeam).toEqual([]);
  });
  it("ignores core data received for a previous restaurant", async () => {
    let finish!: (value: unknown) => void;
    hotel.getSettings.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useHotelSetupReadiness(id, false), { initialProps: { id: 52 } });
    hotel.listRooms.mockResolvedValue([]);
    rerender({ id: 53 });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => finish(settings));
    expect(result.current.readiness?.operationalReady).toBe(false);
  });
});
