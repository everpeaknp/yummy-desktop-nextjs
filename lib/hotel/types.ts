export interface HotelApiEnvelope<T> {
  status: string;
  message?: string;
  data: T;
}

export interface HotelPropertySettings {
  id: number;
  restaurant_id: number;
  default_checkin_time: string;
  default_checkout_time: string;
  currency: string;
  allow_overbooking: boolean;
  require_clean_room_for_checkin: boolean;
  version: number;
}

export interface HotelBuilding {
  id: number;
  restaurant_id: number;
  name: string;
  code: string | null;
  sort_order: number;
  pos_x: number;
  pos_y: number;
  layout_width: number;
  layout_height: number;
  is_active: boolean;
  version: number;
  floor_count?: number;
  room_count?: number;
  occupied_count?: number;
  ready_count?: number;
  attention_count?: number;
}

export interface HotelFloor {
  id: number;
  restaurant_id: number;
  building_id: number;
  name: string;
  sort_order: number;
  layout_width: number;
  layout_height: number;
  is_active: boolean;
  building: HotelBuilding;
}

export interface HotelRoomType {
  id: number;
  restaurant_id: number;
  code: string;
  name: string;
  description: string | null;
  base_occupancy: number;
  max_adults: number;
  max_children: number;
  base_rate: string | number;
  amenities: string[];
  is_active: boolean;
}

export interface HotelRoom {
  id: number;
  restaurant_id: number;
  room_type_id: number;
  floor_id: number | null;
  number: string;
  name: string | null;
  capacity: number;
  occupancy_status: "vacant" | "occupied";
  housekeeping_status: "clean" | "dirty" | "cleaning" | "inspected";
  service_status: "in_service" | "out_of_service" | "out_of_order";
  notes: string | null;
  pos_x: number;
  pos_y: number;
  layout_width: number;
  layout_height: number;
  door_side: "top" | "right" | "bottom" | "left";
  door_offset: number;
  is_active: boolean;
  version: number;
  room_type: HotelRoomType;
  floor: HotelFloor | null;
}

export interface HotelRatePlan {
  id: number;
  restaurant_id: number;
  code: string;
  name: string;
  meal_plan: string;
  refundable: boolean;
  cancellation_policy: string | null;
  early_departure_policy: HotelEarlyDeparturePolicy;
  early_departure_value: string | number;
  is_active: boolean;
}

export type HotelEarlyDeparturePolicy =
  | "refund_unused"
  | "charge_one_night"
  | "charge_percentage"
  | "charge_fixed"
  | "retain_full";

export interface HotelDailyRate {
  id: number;
  room_type_id: number;
  rate_plan_id: number;
  stay_date: string;
  price: string | number;
  min_stay: number;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
}

export interface HotelAvailabilityRoomType {
  room_type: HotelRoomType;
  total_inventory: number;
  available_inventory: number;
  available_rooms: HotelRoom[];
  nightly_rates: Array<string | number>;
  stay_total: string | number;
  rate_options: HotelAvailabilityRateOption[];
}

export interface HotelAvailabilityRateOption {
  rate_plan: HotelRatePlan;
  nightly_rates: Array<string | number>;
  stay_total: string | number;
}

export interface HotelAvailability {
  arrival_date: string;
  departure_date: string;
  nights: number;
  room_types: HotelAvailabilityRoomType[];
}

export interface HotelBookingNight {
  id: number;
  stay_date: string;
  unit_rate: string | number;
  tax_amount: string | number;
  service_charge: string | number;
  posted_at: string | null;
  status: "scheduled" | "charged" | "waived" | "retained";
  disposition_reason: string | null;
}

export interface HotelBookingRoom {
  id: number;
  room_type_id: number;
  assigned_room_id: number | null;
  rate_plan_id: number | null;
  arrival_date: string;
  departure_date: string;
  original_departure_date: string;
  adults: number;
  children: number;
  allocation_status: string;
  room_charge_total: string | number;
  early_departure_policy: HotelEarlyDeparturePolicy;
  early_departure_value: string | number;
  room_type: HotelRoomType;
  assigned_room: HotelRoom | null;
  rate_plan: HotelRatePlan | null;
  nights: HotelBookingNight[];
}

export interface HotelBookingGuest {
  id: number;
  booking_room_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  guest_type: string;
  identity_type: string | null;
  identity_number: string | null;
  is_primary: boolean;
}

export interface HotelBooking {
  id: number;
  restaurant_id: number;
  confirmation_code: string;
  customer_id: number | null;
  primary_guest_name: string;
  primary_guest_phone: string | null;
  primary_guest_email: string | null;
  arrival_date: string;
  departure_date: string;
  original_departure_date: string;
  expected_checkin_at: string;
  expected_checkout_at: string;
  adults: number;
  children: number;
  status: string;
  source: string;
  currency: string;
  deposit_required: string | number;
  deposit_paid: string | number;
  special_requests: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  rooms: HotelBookingRoom[];
  guests: HotelBookingGuest[];
}

export interface HotelFolioEntry {
  id: number;
  entry_type: "charge" | "payment" | "adjustment" | "refund" | "transfer";
  category: string;
  description: string;
  amount: string | number;
  service_date: string;
  source_type: string | null;
  source_id: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  posted_at: string;
  voided_at: string | null;
  void_reason: string | null;
  payment: HotelFolioPayment | null;
}

export type HotelPaymentMethod = "cash" | "card" | "digital" | "fonepay" | "credit" | "other";

export interface HotelFolioPayment {
  id: number;
  folio_id: number;
  folio_entry_id: number;
  drawer_session_id: number | null;
  method: HotelPaymentMethod;
  amount: string | number;
  reference: string | null;
  instrument_type: string | null;
  instrument_name: string | null;
  instrument_meta: Record<string, unknown> | null;
  idempotency_key: string;
  received_by: number | null;
  received_at: string;
}

export interface HotelFolioPaymentInput {
  method: HotelPaymentMethod;
  amount: number;
  reference?: string | null;
  instrument?: { type: string; name: string; meta?: Record<string, unknown> | null } | null;
  drawer_session_id?: number | null;
  idempotency_key: string;
}

export interface HotelFolioRefundInput extends HotelFolioPaymentInput {
  reason: string;
}

export interface HotelFolio {
  id: number;
  stay_id: number;
  folio_number: string;
  name: string;
  status: string;
  currency: string;
  balance: string | number;
  entries: HotelFolioEntry[];
}

export interface HotelFolioPaymentQuote {
  folio: HotelFolio;
  posted_balance: string | number;
  unposted_room_charges: string | number;
  maximum_payment: string | number;
}

export interface HotelEarlyDepartureRoomQuote {
  booking_room_id: number;
  room_number: string | null;
  policy: HotelEarlyDeparturePolicy;
  policy_value: string | number;
  booked_policy: HotelEarlyDeparturePolicy;
  booked_policy_value: string | number;
  policy_overridden: boolean;
  original_departure_date: string;
  departure_date: string;
  consumed_nights: number;
  unused_nights: number;
  consumed_room_value: string | number;
  unused_room_value: string | number;
  early_departure_fee: string | number;
}

export interface HotelEarlyDepartureQuote {
  stay_id: number;
  currency: string;
  original_departure_date: string;
  departure_date: string;
  current_balance: string | number;
  original_booking_value: string | number;
  consumed_room_value: string | number;
  unused_room_value: string | number;
  early_departure_fee: string | number;
  final_room_value: string | number;
  projected_balance: string | number;
  amount_due: string | number;
  refund_due: string | number;
  already_applied: boolean;
  rooms: HotelEarlyDepartureRoomQuote[];
}

export interface HotelStayRoomAssignment {
  id: number;
  booking_room_id: number;
  room_id: number;
  assigned_at: string;
  released_at: string | null;
  reason: string;
  room: HotelRoom;
}

export interface HotelStay {
  id: number;
  restaurant_id: number;
  booking_id: number;
  status: string;
  actual_checkin_at: string | null;
  expected_checkout_at: string;
  actual_checkout_at: string | null;
  checkout_override_reason: string | null;
  early_departure_date: string | null;
  early_departure_reason: string | null;
  early_departure_applied_at: string | null;
  early_departure_approved_by: number | null;
  early_departure_override_policy: HotelEarlyDeparturePolicy | null;
  early_departure_override_value: string | number | null;
  early_departure_override_reason: string | null;
  early_departure_override_approved_by: number | null;
  early_departure_override_approved_at: string | null;
  version: number;
  booking: HotelBooking;
  folios: HotelFolio[];
  assignments: HotelStayRoomAssignment[];
}

export interface HotelFrontDesk {
  business_date: string;
  arrivals: HotelBooking[];
  departures: HotelBooking[];
  in_house: HotelStay[];
  unassigned: HotelBooking[];
  room_counts: Record<string, number>;
}

export interface HotelHousekeepingTask {
  id: number;
  restaurant_id: number;
  room_id: number;
  business_date: string;
  task_type: string;
  status: string;
  priority: number;
  assigned_to: number | null;
  notes: string | null;
  room: HotelRoom;
}

export interface HotelNightAudit {
  business_date: string;
  status: string;
  blockers: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
}

export interface HotelRoomOrderContext {
  id: number;
  stay_id: number;
  folio_id: number;
  room_id: number;
  stay_room_assignment_id: number;
  room_number: string;
  guest_name: string;
  folio_number: string;
  settlement_status: "unsettled" | "paid_now" | "posted_to_folio" | "voided";
  folio_entry_id: number | null;
  settled_amount: string | number;
  settled_at: string | null;
}

export interface HotelRoomOrder {
  id: number;
  restaurant_order_id: number | null;
  channel: "room_service";
  status: string;
  customer_name: string | null;
  grand_total: string | number;
  created_at: string;
  room_order_context: HotelRoomOrderContext;
}

export interface HotelRoomOrderSettlement {
  order_id: number;
  settlement_status: HotelRoomOrderContext["settlement_status"];
  folio_id: number;
  folio_entry_id: number | null;
  settled_amount: string | number;
}

export interface HotelRoomOrderAnalytics {
  order_count: number;
  completed_order_count: number;
  gross_sales: string | number;
  paid_now_sales: string | number;
  posted_to_folio_sales: string | number;
  unsettled_sales: string | number;
  average_order_value: string | number;
  orders_by_room: Array<{
    room_id: number;
    room_number: string;
    order_count: number;
    gross_sales: string | number;
  }>;
}

export interface HotelBookingCreateInput {
  restaurant_id: number;
  customer_id?: number | null;
  primary_guest_name: string;
  primary_guest_phone?: string | null;
  primary_guest_email?: string | null;
  arrival_date: string;
  departure_date: string;
  source?: string;
  status?: "held" | "pending" | "confirmed";
  deposit_required?: number;
  deposit_paid?: number;
  special_requests?: string | null;
  notes?: string | null;
  rooms: Array<{
    room_type_id: number;
    assigned_room_id?: number | null;
    rate_plan_id: number;
    adults: number;
    children: number;
    guests?: Array<{
      name: string;
      phone?: string | null;
      email?: string | null;
      guest_type?: "adult" | "child";
      is_primary?: boolean;
    }>;
  }>;
}

export interface HotelFolioEntryInput {
  entry_type: Exclude<HotelFolioEntry["entry_type"], "payment">;
  category: string;
  description: string;
  amount: number;
  service_date: string;
  idempotency_key: string;
  source_type?: string;
  source_id?: string;
  metadata?: Record<string, unknown>;
}

export function hotelMoney(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPreArrivalBooking(booking: HotelBooking): boolean {
  return ["held", "pending", "confirmed"].includes(booking.status);
}

export function hasUnassignedRooms(booking: HotelBooking): boolean {
  return booking.rooms.some((room) => room.assigned_room_id == null);
}
