import type { HotelBookingNight, HotelFolio, HotelFolioEntry } from "./types";
import { hotelMoney } from "./types";

const MONEY_TOLERANCE = 0.005;

export function hasHotelPaymentDue(maximumPayment: string | number): boolean {
  return hotelMoney(maximumPayment) > MONEY_TOLERANCE;
}

export type HotelBillPaymentStatus = "due" | "paid" | "credit";

export interface HotelBillSummary {
  roomCharges: number;
  roomServiceCharges: number;
  otherCharges: number;
  discounts: number;
  otherCredits: number;
  totalBill: number;
  amountPaid: number;
  balanceDue: number;
  guestCredit: number;
  expectedBalance: number;
  remainingRoomCharges: number;
  paymentStatus: HotelBillPaymentStatus;
  payments: HotelFolioEntry[];
  activity: HotelFolioEntry[];
}

export function buildHotelBillSummary(
  folio: HotelFolio,
  unpostedRoomCharges: string | number = 0,
): HotelBillSummary {
  const activity = folio.entries.filter((entry) => entry.voided_at == null);
  const remainingRoomCharges = Math.max(0, hotelMoney(unpostedRoomCharges));
  const payments = activity.filter((entry) => ["payment", "refund"].includes(entry.entry_type));
  const refunds = activity.filter((entry) => entry.entry_type === "refund");

  const roomCharges =
    remainingRoomCharges +
    sum(activity, (entry) =>
      entry.entry_type === "charge" && entry.category === "room"
        ? Math.max(0, hotelMoney(entry.amount))
        : 0,
    );
  const roomServiceCharges = sum(activity, (entry) =>
    entry.entry_type === "charge" && entry.category === "room_service"
      ? Math.max(0, hotelMoney(entry.amount))
      : 0,
  );
  const otherCharges = sum(activity, (entry) => {
    const amount = hotelMoney(entry.amount);
    if (amount <= 0 || entry.entry_type === "payment" || entry.entry_type === "refund") return 0;
    if (entry.entry_type === "charge" && ["room", "room_service"].includes(entry.category)) return 0;
    return amount;
  });
  const discounts = sum(activity, (entry) =>
    entry.entry_type === "adjustment" && entry.category === "discount"
      ? Math.max(0, -hotelMoney(entry.amount))
      : 0,
  );
  const otherCredits = sum(activity, (entry) => {
    const amount = hotelMoney(entry.amount);
    if (amount >= 0 || entry.entry_type === "payment") return 0;
    if (entry.entry_type === "adjustment" && entry.category === "discount") return 0;
    return -amount;
  });
  const grossPayments = sum(
    payments,
    (entry) => entry.entry_type === "payment" ? Math.max(0, -hotelMoney(entry.amount)) : 0,
  );
  const refunded = sum(refunds, (entry) => Math.max(0, hotelMoney(entry.amount)));
  const amountPaid = Math.max(0, grossPayments - refunded);
  const expectedBalance = hotelMoney(folio.balance) + remainingRoomCharges;
  const balanceDue = expectedBalance > MONEY_TOLERANCE ? expectedBalance : 0;
  const guestCredit = expectedBalance < -MONEY_TOLERANCE ? -expectedBalance : 0;
  const totalBill = Math.max(0, expectedBalance + amountPaid);
  const paymentStatus: HotelBillPaymentStatus =
    balanceDue > 0 ? "due" : guestCredit > 0 ? "credit" : "paid";

  return {
    roomCharges,
    roomServiceCharges,
    otherCharges,
    discounts,
    otherCredits,
    totalBill,
    amountPaid,
    balanceDue,
    guestCredit,
    expectedBalance,
    remainingRoomCharges,
    paymentStatus,
    payments,
    activity,
  };
}

export function unbilledBookingRoomCharges(
  booking: {
    rooms: Array<{
      nights: Array<
        Pick<HotelBookingNight, "id" | "unit_rate" | "tax_amount" | "service_charge" | "status">
      >;
    }>;
  },
  folio: HotelFolio,
): number {
  const billedNightIds = new Set(
    folio.entries
      .filter(
        (entry) =>
          entry.voided_at == null &&
          entry.entry_type === "charge" &&
          entry.category === "room" &&
          entry.source_type === "booking_night" &&
          entry.source_id != null,
      )
      .map((entry) => entry.source_id as string),
  );

  return booking.rooms.reduce(
    (bookingTotal, room) =>
      bookingTotal +
      room.nights.reduce(
        (roomTotal, night) =>
          night.status !== "scheduled" || billedNightIds.has(String(night.id))
            ? roomTotal
            : roomTotal +
              hotelMoney(night.unit_rate) +
              hotelMoney(night.tax_amount) +
              hotelMoney(night.service_charge),
        0,
      ),
    0,
  );
}

export function hotelPaymentLabel(entry: HotelFolioEntry): string {
  const metadataInstrument = typeof entry.metadata.instrument_name === "string"
    ? entry.metadata.instrument_name.trim()
    : "";
  const instrumentName = entry.payment?.instrument_name?.trim() || metadataInstrument;
  if (instrumentName) return entry.entry_type === "refund" ? `Refund - ${instrumentName}` : instrumentName;
  const method = entry.payment?.method || entry.category;
  const labels: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    digital: "QR / digital payment",
    fonepay: "Fonepay",
    credit: "Customer credit",
    deposit: "Advance payment",
    other: "Other payment",
  };
  const label = labels[method] ?? "Payment";
  return entry.entry_type === "refund" ? `Refund - ${label}` : label;
}

export function hotelPaymentReference(entry: HotelFolioEntry): string {
  if (entry.payment?.reference) return entry.payment.reference;
  return typeof entry.metadata.reference === "string" ? entry.metadata.reference : "";
}

export function hotelBillActivityLabel(entry: HotelFolioEntry): string {
  if (entry.entry_type === "payment") return hotelPaymentLabel(entry);
  if (entry.entry_type === "refund") return "Refund";
  if (entry.category === "room") return "Room charge";
  if (entry.category === "room_service") return entry.description || "Room service";
  if (entry.category === "discount") return "Discount";
  return entry.description || "Bill adjustment";
}

export function hotelBillActivityAmountLabel(entry: HotelFolioEntry): string {
  if (entry.entry_type === "payment") return "Paid";
  if (entry.entry_type === "refund") return "Refunded";
  if (hotelMoney(entry.amount) < 0) return "Credit";
  return "Charge";
}

function sum(entries: HotelFolioEntry[], value: (entry: HotelFolioEntry) => number): number {
  return entries.reduce((total, entry) => total + value(entry), 0);
}
