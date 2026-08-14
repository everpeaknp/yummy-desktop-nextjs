import type { AxiosResponse } from "axios";
import { format } from "date-fns";
import apiClient from "@/lib/api-client";
import { HotelPmsApis } from "@/lib/api/endpoints";
import type {
  HotelApiEnvelope,
  HotelAvailability,
  HotelBooking,
  HotelBookingCreateInput,
  HotelBuilding,
  HotelDailyRate,
  HotelFloor,
  HotelFolio,
  HotelFolioEntryInput,
  HotelFolioPaymentInput,
  HotelFolioRefundInput,
  HotelFolioPaymentQuote,
  HotelEarlyDepartureQuote,
  HotelFrontDesk,
  HotelHousekeepingTask,
  HotelNightAudit,
  HotelPropertySettings,
  HotelRatePlan,
  HotelRoom,
  HotelRoomOrder,
  HotelRoomOrderAnalytics,
  HotelRoomOrderSettlement,
  HotelRoomType,
  HotelStay,
} from "./types";

export function unwrapHotelResponse<T>(
  response: AxiosResponse<HotelApiEnvelope<T> | T>,
): T {
  const body = response.data;
  if (body && typeof body === "object" && "data" in body) {
    return (body as HotelApiEnvelope<T>).data;
  }
  return body as T;
}

export function hotelDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export const hotelPmsApi = {
  async getSettings(restaurantId: number): Promise<HotelPropertySettings> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.settings, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async updateSettings(
    restaurantId: number,
    input: Partial<
      Pick<
        HotelPropertySettings,
        | "default_checkin_time"
        | "default_checkout_time"
        | "currency"
        | "allow_overbooking"
        | "require_clean_room_for_checkin"
      >
    > & { version: number },
  ): Promise<HotelPropertySettings> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.settings, input, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async getFrontDesk(
    restaurantId: number,
    businessDate: string,
  ): Promise<HotelFrontDesk> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.frontDesk, {
        params: { restaurant_id: restaurantId, business_date: businessDate },
      }),
    );
  },

  async listBookings(
    restaurantId: number,
    filters: {
      status?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
    } = {},
  ): Promise<HotelBooking[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.bookings, {
        params: { restaurant_id: restaurantId, ...filters },
      }),
    );
  },

  async getBooking(bookingId: number): Promise<HotelBooking> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.booking(bookingId)),
    );
  },

  async getAvailability(
    restaurantId: number,
    arrivalDate: string,
    departureDate: string,
    options: {
      room_type_id?: number;
      rate_plan_id?: number;
      exclude_booking_id?: number;
    } = {},
  ): Promise<HotelAvailability> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.availability, {
        params: {
          restaurant_id: restaurantId,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          ...options,
        },
      }),
    );
  },

  async createBooking(input: HotelBookingCreateInput): Promise<HotelBooking> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.bookings, input),
    );
  },

  async assignRooms(
    bookingId: number,
    version: number,
    assignments: Record<number, number>,
  ): Promise<HotelBooking> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.assignBooking(bookingId), {
        version,
        assignments,
      }),
    );
  },

  async cancelBooking(
    bookingId: number,
    version: number,
    reason: string,
  ): Promise<HotelBooking> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.cancelBooking(bookingId), {
        version,
        reason,
      }),
    );
  },

  async markNoShow(bookingId: number, version: number): Promise<HotelBooking> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.noShowBooking(bookingId), undefined, {
        params: { version },
      }),
    );
  },

  async checkIn(
    bookingId: number,
    bookingVersion: number,
    assignments: Record<number, number>,
  ): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.checkIn(bookingId), {
        booking_version: bookingVersion,
        assignments,
      }),
    );
  },

  async getBookingStay(bookingId: number): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.bookingStay(bookingId)),
    );
  },

  async checkout(stayId: number, stayVersion: number): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.checkout(stayId), {
        stay_version: stayVersion,
        allow_unsettled: false,
      }),
    );
  },

  async prepareCheckout(
    stayId: number,
    stayVersion: number,
  ): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.prepareCheckout(stayId), {
        stay_version: stayVersion,
        allow_unsettled: false,
      }),
    );
  },

  async quoteEarlyDeparture(
    stayId: number,
    input: {
      stay_version: number;
      departure_date: string;
      reason?: string | null;
      override_policy?: import("./types").HotelEarlyDeparturePolicy | null;
      override_value?: number;
      override_reason?: string | null;
    },
  ): Promise<HotelEarlyDepartureQuote> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.earlyDepartureQuote(stayId), input),
    );
  },

  async prepareEarlyDeparture(
    stayId: number,
    input: {
      stay_version: number;
      departure_date: string;
      reason?: string | null;
      override_policy?: import("./types").HotelEarlyDeparturePolicy | null;
      override_value?: number;
      override_reason?: string | null;
    },
  ): Promise<HotelEarlyDepartureQuote> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.prepareEarlyDeparture(stayId), input),
    );
  },

  async moveRoom(
    stayId: number,
    input: {
      stay_version: number;
      booking_room_id: number;
      target_room_id: number;
      reason: string;
    },
  ): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.moveRoom(stayId), input),
    );
  },

  async extendStay(
    stayId: number,
    stayVersion: number,
    newDepartureDate: string,
  ): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.extendStay(stayId), {
        stay_version: stayVersion,
        new_departure_date: newDepartureDate,
      }),
    );
  },

  async postFolioEntry(
    folioId: number,
    input: HotelFolioEntryInput,
  ): Promise<HotelFolio> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.folioEntries(folioId), input),
    );
  },

  async addFolioPayment(
    folioId: number,
    input: HotelFolioPaymentInput,
  ): Promise<HotelFolio> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.folioPayments(folioId), input),
    );
  },

  async addFolioRefund(
    folioId: number,
    input: HotelFolioRefundInput,
  ): Promise<HotelFolio> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.folioRefunds(folioId), input),
    );
  },

  async getFolioPaymentQuote(folioId: number): Promise<HotelFolioPaymentQuote> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.folioPaymentQuote(folioId)),
    );
  },

  async applyFolioDiscount(
    folioId: number,
    input: {
      amount: number;
      reason: string;
      idempotency_key: string;
      loyalty_points_redeemed?: number;
    },
  ): Promise<HotelFolio> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.folioDiscounts(folioId), input),
    );
  },

  async updateStayCustomer(
    stayId: number,
    input: { booking_version: number; customer_id: number },
  ): Promise<HotelStay> {
    return unwrapHotelResponse(
      await apiClient.put(HotelPmsApis.stayCustomer(stayId), input),
    );
  },

  async listRoomTypes(restaurantId: number): Promise<HotelRoomType[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.roomTypes, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async listBuildings(restaurantId: number): Promise<HotelBuilding[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.buildings, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async createBuilding(input: {
    restaurant_id: number;
    name: string;
    code?: string | null;
    sort_order?: number;
    pos_x?: number;
    pos_y?: number;
    layout_width?: number;
    layout_height?: number;
  }): Promise<HotelBuilding> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.buildings, input),
    );
  },

  async updateBuilding(
    buildingId: number,
    input: Partial<
      Pick<
        HotelBuilding,
        | "name"
        | "code"
        | "sort_order"
        | "pos_x"
        | "pos_y"
        | "layout_width"
        | "layout_height"
        | "is_active"
      >
    > & { version: number },
  ): Promise<HotelBuilding> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.building(buildingId), input),
    );
  },

  async listFloors(restaurantId: number): Promise<HotelFloor[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.floors, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async createFloor(input: {
    restaurant_id: number;
    building_id?: number;
    name: string;
    sort_order?: number;
    layout_width?: number;
    layout_height?: number;
  }): Promise<HotelFloor> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.floors, input),
    );
  },

  async updateFloor(
    floorId: number,
    input: {
      building_id?: number;
      name?: string;
      sort_order?: number;
      layout_width?: number;
      layout_height?: number;
      is_active?: boolean;
    },
  ): Promise<HotelFloor> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.floor(floorId), input),
    );
  },

  async listRatePlans(restaurantId: number): Promise<HotelRatePlan[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.ratePlans, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async createRatePlan(input: {
    restaurant_id: number;
    code: string;
    name: string;
    meal_plan: string;
    refundable: boolean;
    cancellation_policy?: string | null;
    early_departure_policy?: import("./types").HotelEarlyDeparturePolicy;
    early_departure_value?: number;
  }): Promise<HotelRatePlan> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.ratePlans, input),
    );
  },

  async upsertDailyRate(input: {
    restaurant_id: number;
    room_type_id: number;
    rate_plan_id: number;
    stay_date: string;
    price: number;
    min_stay: number;
    closed_to_arrival: boolean;
    closed_to_departure: boolean;
  }): Promise<HotelDailyRate> {
    return unwrapHotelResponse(
      await apiClient.put(HotelPmsApis.dailyRates, input),
    );
  },

  async listRooms(restaurantId: number): Promise<HotelRoom[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.rooms, {
        params: { restaurant_id: restaurantId },
      }),
    );
  },

  async createRoomType(input: {
    restaurant_id: number;
    code: string;
    name: string;
    base_rate: number;
    max_adults: number;
    max_children: number;
  }): Promise<HotelRoomType> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.roomTypes, input),
    );
  },

  async createRoom(input: {
    restaurant_id: number;
    room_type_id: number;
    number: string;
    capacity: number;
    floor_id?: number | null;
    name?: string | null;
    notes?: string | null;
    pos_x?: number;
    pos_y?: number;
    layout_width?: number;
    layout_height?: number;
    door_side?: HotelRoom["door_side"];
    door_offset?: number;
  }): Promise<HotelRoom> {
    return unwrapHotelResponse(await apiClient.post(HotelPmsApis.rooms, input));
  },

  async updateRoom(
    roomId: number,
    input: {
      version: number;
      room_type_id?: number;
      floor_id?: number | null;
      number?: string;
      name?: string | null;
      capacity?: number;
      notes?: string | null;
      pos_x?: number;
      pos_y?: number;
      layout_width?: number;
      layout_height?: number;
      door_side?: HotelRoom["door_side"];
      door_offset?: number;
      is_active?: boolean;
    },
  ): Promise<HotelRoom> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.room(roomId), input),
    );
  },

  async updateRoomStatus(
    roomId: number,
    version: number,
    status: { housekeeping_status?: string; service_status?: string },
  ): Promise<HotelRoom> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.roomStatus(roomId), {
        version,
        ...status,
      }),
    );
  },

  async listStayRoomOrders(stayId: number): Promise<HotelRoomOrder[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.stayRoomOrders(stayId)),
    );
  },

  async postRoomOrderToFolio(
    orderId: number,
  ): Promise<HotelRoomOrderSettlement> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.postRoomOrderToFolio(orderId)),
    );
  },

  async getRoomOrderAnalytics(
    restaurantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<HotelRoomOrderAnalytics> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.roomOrderAnalytics, {
        params: {
          restaurant_id: restaurantId,
          date_from: dateFrom,
          date_to: dateTo,
        },
      }),
    );
  },

  async listHousekeeping(
    restaurantId: number,
    businessDate: string,
  ): Promise<HotelHousekeepingTask[]> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.housekeeping, {
        params: { restaurant_id: restaurantId, business_date: businessDate },
      }),
    );
  },

  async updateHousekeepingTask(
    taskId: number,
    status: string,
  ): Promise<HotelHousekeepingTask> {
    return unwrapHotelResponse(
      await apiClient.patch(HotelPmsApis.housekeepingTask(taskId), { status }),
    );
  },

  async previewNightAudit(
    restaurantId: number,
    businessDate: string,
  ): Promise<HotelNightAudit> {
    return unwrapHotelResponse(
      await apiClient.get(HotelPmsApis.nightAuditPreview, {
        params: { restaurant_id: restaurantId, business_date: businessDate },
      }),
    );
  },

  async runNightAudit(
    restaurantId: number,
    businessDate: string,
  ): Promise<HotelNightAudit> {
    return unwrapHotelResponse(
      await apiClient.post(HotelPmsApis.nightAuditRun, undefined, {
        params: { restaurant_id: restaurantId, business_date: businessDate },
      }),
    );
  },
};

export type HotelPmsApi = typeof hotelPmsApi;
