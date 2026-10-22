import { describe, expect, it } from "vitest";
import {
  buildHotelBillSummary,
  hasHotelPaymentDue,
  hotelPaymentLabel,
  hotelPaymentReference,
  unbilledBookingRoomCharges,
} from "./bill-summary";
import type { HotelFolio, HotelFolioEntry } from "./types";

function entry(
  id: number,
  entryType: HotelFolioEntry["entry_type"],
  category: string,
  amount: number,
): HotelFolioEntry {
  return {
    id,
    entry_type: entryType,
    category,
    description: category,
    amount,
    service_date: "2026-08-13",
    source_type: null,
    source_id: null,
    idempotency_key: `entry-${id}`,
    metadata: {},
    posted_at: "2026-08-13T10:00:00Z",
    voided_at: null,
    void_reason: null,
    payment: null,
  };
}

function folio(balance: number, entries: HotelFolioEntry[]): HotelFolio {
  return {
    id: 1,
    stay_id: 1,
    folio_number: "F-TEST",
    name: "Primary",
    status: "open",
    currency: "NPR",
    balance,
    entries,
  };
}

describe("buildHotelBillSummary", () => {
  it("combines scheduled room charges, room service, and payments", () => {
    const summary = buildHotelBillSummary(
      folio(-5000, [
        entry(1, "payment", "cash", -5000),
        entry(2, "charge", "room_service", 50),
        entry(3, "payment", "cash", -50),
      ]),
      5000,
    );

    expect(summary.totalBill).toBe(5050);
    expect(summary.amountPaid).toBe(5050);
    expect(summary.balanceDue).toBe(0);
    expect(summary.guestCredit).toBe(0);
    expect(summary.paymentStatus).toBe("paid");
  });

  it("shows overpayment as guest credit instead of a negative balance", () => {
    const summary = buildHotelBillSummary(
      folio(-500, [entry(1, "payment", "cash", -5500), entry(2, "charge", "room", 5000)]),
    );

    expect(summary.totalBill).toBe(5000);
    expect(summary.guestCredit).toBe(500);
    expect(summary.balanceDue).toBe(0);
    expect(summary.paymentStatus).toBe("credit");
  });

  it("excludes voided activity and separates discounts", () => {
    const voided = { ...entry(3, "charge", "room_service", 900), voided_at: "2026-08-13T12:00:00Z" };
    const summary = buildHotelBillSummary(
      folio(900, [entry(1, "charge", "room", 1000), entry(2, "adjustment", "discount", -100), voided]),
    );

    expect(summary.totalBill).toBe(900);
    expect(summary.discounts).toBe(100);
    expect(summary.roomServiceCharges).toBe(0);
    expect(summary.activity).toHaveLength(2);
  });

  it("shows refunds with their instrument and nets them from amount paid", () => {
    const refund = {
      ...entry(2, "refund", "card", 300),
      metadata: { instrument_name: "Visa terminal", reference: "REF-300" },
    };
    const summary = buildHotelBillSummary(
      folio(700, [entry(1, "payment", "card", -1000), refund]),
    );

    expect(summary.amountPaid).toBe(700);
    expect(summary.payments).toHaveLength(2);
    expect(hotelPaymentLabel(refund)).toBe("Refund - Visa terminal");
    expect(hotelPaymentReference(refund)).toBe("REF-300");
  });

  it("derives missing room charges from booking nights and active bill entries", () => {
    const chargedNight = {
      ...entry(4, "charge", "room", 1000),
      source_type: "booking_night",
      source_id: "10",
    };
    const booking = {
      rooms: [
        {
          nights: [
            { id: 10, unit_rate: 1000, tax_amount: 0, service_charge: 0, status: "charged" as const },
            { id: 11, unit_rate: 1200, tax_amount: 120, service_charge: 60, status: "scheduled" as const },
          ],
        },
      ],
    };

    expect(unbilledBookingRoomCharges(booking, folio(1000, [chargedNight]))).toBe(1380);
  });

  it("does not treat waived early-departure nights as collectible room charges", () => {
    const booking = { rooms: [{ nights: [
      { id: 11, unit_rate: 1200, tax_amount: 120, service_charge: 60, status: "waived" as const },
    ] }] };
    expect(unbilledBookingRoomCharges(booking, folio(0, []))).toBe(0);
  });
});

describe("hasHotelPaymentDue", () => {
  it("only exposes payment actions when the server quote has a collectible balance", () => {
    expect(hasHotelPaymentDue(5000)).toBe(true);
    expect(hasHotelPaymentDue(0.01)).toBe(true);
    expect(hasHotelPaymentDue(0.005)).toBe(false);
    expect(hasHotelPaymentDue(0)).toBe(false);
    expect(hasHotelPaymentDue(-50)).toBe(false);
  });
});
