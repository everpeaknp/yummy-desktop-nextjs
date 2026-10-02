import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";
import { hotelPmsApi, unwrapHotelResponse } from "./api";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue({ data: { status: "success", data: [] } });
  mocked.post.mockResolvedValue({ data: { status: "success", data: {} } });
  mocked.patch.mockResolvedValue({ data: { status: "success", data: {} } });
  mocked.put.mockResolvedValue({ data: { status: "success", data: {} } });
});

describe("hotelPmsApi", () => {
  it("unwraps both backend envelopes and direct payloads", () => {
    expect(
      unwrapHotelResponse({
        data: { status: "success", data: { id: 7 } },
      } as never),
    ).toEqual({ id: 7 });
    expect(unwrapHotelResponse({ data: { id: 8 } } as never)).toEqual({
      id: 8,
    });
  });

  it("uses the authoritative front desk, booking, and availability contracts", async () => {
    await hotelPmsApi.getFrontDesk(9, "2026-08-12");
    await hotelPmsApi.listBookings(9, { status: "confirmed", search: "Asha" });
    await hotelPmsApi.getAvailability(9, "2026-08-12", "2026-08-14", {
      exclude_booking_id: 31,
    });
    await hotelPmsApi.createBooking({
      restaurant_id: 9,
      customer_id: 52,
      primary_guest_name: "Asha Rai",
      arrival_date: "2026-08-12",
      departure_date: "2026-08-14",
      rooms: [{ room_type_id: 4, rate_plan_id: 2, adults: 2, children: 0 }],
    });

    expect(mocked.get).toHaveBeenNthCalledWith(1, "/hotel/v2/front-desk", {
      params: { restaurant_id: 9, business_date: "2026-08-12" },
    });
    expect(mocked.get).toHaveBeenNthCalledWith(2, "/hotel/v2/bookings", {
      params: { restaurant_id: 9, status: "confirmed", search: "Asha" },
    });
    expect(mocked.get).toHaveBeenNthCalledWith(3, "/hotel/v2/availability", {
      params: {
        restaurant_id: 9,
        arrival_date: "2026-08-12",
        departure_date: "2026-08-14",
        exclude_booking_id: 31,
      },
    });
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/bookings",
      expect.objectContaining({
        customer_id: 52,
        primary_guest_name: "Asha Rai",
      }),
    );
  });

  it("sends optimistic versions for assignment, stay, and room-state mutations", async () => {
    await hotelPmsApi.assignRooms(21, 3, { 81: 12 });
    await hotelPmsApi.checkIn(21, 4, { 81: 12 });
    await hotelPmsApi.moveRoom(44, {
      stay_version: 2,
      booking_room_id: 81,
      target_room_id: 13,
      reason: "Guest requested a quieter room",
    });
    await hotelPmsApi.extendStay(44, 3, "2026-08-15");
    await hotelPmsApi.prepareCheckout(44, 4);
    await hotelPmsApi.quoteEarlyDeparture(44, {
      stay_version: 4,
      departure_date: "2026-08-13",
    });
    await hotelPmsApi.prepareEarlyDeparture(44, {
      stay_version: 4,
      departure_date: "2026-08-13",
      reason: "Travel changed",
    });
    await hotelPmsApi.checkout(44, 4);
    await hotelPmsApi.updateFloor(2, { name: "Ground floor", sort_order: 0 });
    await hotelPmsApi.updateRoom(13, {
      version: 5,
      number: "201",
      floor_id: 2,
      room_type_id: 4,
      capacity: 3,
      name: "Courtyard room",
      notes: "Extra bed available",
    });
    await hotelPmsApi.updateRoomStatus(13, 5, {
      housekeeping_status: "inspected",
    });

    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/bookings/21/assign", {
      version: 3,
      assignments: { 81: 12 },
    });
    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/bookings/21/check-in", {
      booking_version: 4,
      assignments: { 81: 12 },
    });
    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/stays/44/move-room", {
      stay_version: 2,
      booking_room_id: 81,
      target_room_id: 13,
      reason: "Guest requested a quieter room",
    });
    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/stays/44/extend", {
      stay_version: 3,
      new_departure_date: "2026-08-15",
    });
    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/stays/44/checkout", {
      stay_version: 4,
      allow_unsettled: false,
    });
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/stays/44/prepare-checkout",
      {
        stay_version: 4,
        allow_unsettled: false,
      },
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/stays/44/early-departure/quote",
      {
        stay_version: 4,
        departure_date: "2026-08-13",
      },
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/stays/44/early-departure/prepare",
      {
        stay_version: 4,
        departure_date: "2026-08-13",
        reason: "Travel changed",
      },
    );
    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/floors/2", {
      name: "Ground floor",
      sort_order: 0,
    });
    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/rooms/13", {
      version: 5,
      number: "201",
      floor_id: 2,
      room_type_id: 4,
      capacity: 3,
      name: "Courtyard room",
      notes: "Extra bed available",
    });
    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/rooms/13/status", {
      version: 5,
      housekeeping_status: "inspected",
    });
  });

  it("safely removes property inventory", async () => {
    await hotelPmsApi.updateRoom(13, { version: 6, is_active: false });
    await hotelPmsApi.updateFloor(2, { is_active: false });
    await hotelPmsApi.updateBuilding(4, { version: 5, is_active: false });

    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/rooms/13", {
      version: 6,
      is_active: false,
    });
    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/floors/2", {
      is_active: false,
    });
    expect(mocked.patch).toHaveBeenCalledWith("/hotel/v2/buildings/4", {
      version: 5,
      is_active: false,
    });
  });

  it("keeps rate, housekeeping, folio, and night-audit writes server-owned", async () => {
    await hotelPmsApi.upsertDailyRate({
      restaurant_id: 9,
      room_type_id: 2,
      rate_plan_id: 4,
      stay_date: "2026-08-12",
      price: 3500,
      min_stay: 2,
      closed_to_arrival: false,
      closed_to_departure: true,
    });
    await hotelPmsApi.addFolioPayment(17, {
      method: "cash",
      amount: 3500,
      drawer_session_id: 29,
      idempotency_key: "payment:17:one",
    });
    await hotelPmsApi.addFolioRefund(17, {
      method: "card",
      amount: 500,
      reason: "Unused room nights",
      idempotency_key: "refund:17:one",
    });
    await hotelPmsApi.getFolioPaymentQuote(17);
    await hotelPmsApi.applyFolioDiscount(17, {
      amount: 250,
      reason: "Service recovery",
      idempotency_key: "discount:17:one",
    });
    await hotelPmsApi.updateStayCustomer(44, {
      booking_version: 7,
      customer_id: 93,
    });
    await hotelPmsApi.updateHousekeepingTask(71, "inspected");
    await hotelPmsApi.runNightAudit(9, "2026-08-12");

    expect(mocked.put).toHaveBeenCalledWith(
      "/hotel/v2/daily-rates",
      expect.objectContaining({
        restaurant_id: 9,
        price: 3500,
      }),
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/folios/17/payments",
      expect.objectContaining({
        drawer_session_id: 29,
        idempotency_key: "payment:17:one",
      }),
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/folios/17/refunds",
      expect.objectContaining({
        amount: 500,
        reason: "Unused room nights",
      }),
    );
    expect(mocked.get).toHaveBeenCalledWith(
      "/hotel/v2/folios/17/payment-quote",
    );
    expect(mocked.post).toHaveBeenCalledWith("/hotel/v2/folios/17/discounts", {
      amount: 250,
      reason: "Service recovery",
      idempotency_key: "discount:17:one",
    });
    expect(mocked.put).toHaveBeenCalledWith("/hotel/v2/stays/44/customer", {
      booking_version: 7,
      customer_id: 93,
    });
    expect(mocked.patch).toHaveBeenCalledWith(
      "/hotel/v2/housekeeping/tasks/71",
      {
        status: "inspected",
      },
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/hotel/v2/night-audit/run",
      undefined,
      {
        params: { restaurant_id: 9, business_date: "2026-08-12" },
      },
    );
  });

  it("uses explicit PMS context for room orders and ledger-backed hotel finance", async () => {
    await hotelPmsApi.listStayRoomOrders(44);
    await hotelPmsApi.getRoomOrderAnalytics(9, "2026-08-01", "2026-08-12");
    await hotelPmsApi.getFinanceSummary(9, "2026-08-01", "2026-08-12");

    expect(mocked.get).toHaveBeenNthCalledWith(
      1,
      "/hotel/v2/stays/44/room-orders",
    );
    expect(mocked.get).toHaveBeenNthCalledWith(
      2,
      "/hotel/v2/room-orders/analytics/summary",
      {
        params: {
          restaurant_id: 9,
          date_from: "2026-08-01",
          date_to: "2026-08-12",
        },
      },
    );
    expect(mocked.get).toHaveBeenNthCalledWith(
      3,
      "/hotel/v2/finance/summary",
      {
        params: {
          restaurant_id: 9,
          date_from: "2026-08-01",
          date_to: "2026-08-12",
        },
      },
    );
  });
});
