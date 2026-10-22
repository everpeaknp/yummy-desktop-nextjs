import { describe, expect, it } from "vitest";

import {
  formatDayCloseCloseName,
  formatDayCloseExportFilename,
  formatDayCloseCurrency,
  formatDayCloseNumber,
  pickBackendAmount,
} from "./day-close-format";
import {
  parseDayCloseDetail,
  parseDayCloseListItem,
  parseDayCloseSnapshotData,
  parseDayCloseValidateResult,
} from "@/types/day-close";

describe("day close formatters", () => {
  it("formats backend decimal strings as currency", () => {
    expect(formatDayCloseCurrency("600.00")).toBe("NPR 600.00");
    expect(formatDayCloseCurrency("-100.5")).toBe("NPR -100.50");
  });

  it("formats backend decimal strings as plain numbers", () => {
    expect(formatDayCloseNumber("600.25")).toBe("600.25");
  });

  it("picks numeric backend strings before falling back", () => {
    expect(pickBackendAmount(undefined, null, "500.00", 0)).toBe(500);
  });

  it("keeps invalid values as unavailable", () => {
    expect(formatDayCloseCurrency("not-a-number")).toBe("—");
    expect(formatDayCloseNumber("")).toBe("—");
  });

  it("labels and exports hotel closes as hotel daybooks", () => {
    expect(formatDayCloseCloseName("hotel")).toBe("Hotel Daybook");
    expect(
      formatDayCloseExportFilename(
        {
          id: 42,
          business_line: "hotel",
          period_start_at: null,
          period_end_at: null,
        },
        "pdf",
      ),
    ).toBe("hotel_daybook_42.pdf");
  });

  it("preserves cash-count provenance on detail and history records", () => {
    expect(
      parseDayCloseDetail({
        id: 42,
        restaurant_id: 7,
        status: "confirmed",
        counted_cash: "950.00",
        cash_count_source: "manual_count",
      }),
    ).toMatchObject({ counted_cash: 950, cash_count_source: "manual_count" });
    expect(
      parseDayCloseListItem({
        id: 42,
        status: "confirmed",
        counted_cash: "950.00",
        cash_count_source: "manual_count",
      }),
    ).toMatchObject({ counted_cash: 950, cash_count_source: "manual_count" });
  });

  it("parses stable readiness and drawer-state contracts", () => {
    expect(
      parseDayCloseValidateResult({
        can_close: false,
        issues: [
          {
            code: "PAYMENT_UNEXPLAINED_SHORTFALL",
            severity: "blocker",
            message: "A completed order has an unexplained payment shortfall.",
          },
        ],
        drawer_readiness: [
          {
            name: "Main till",
            state: "needs_count",
            message: "Count this drawer before closing.",
          },
        ],
      }),
    ).toMatchObject({
      issues: [{ code: "PAYMENT_UNEXPLAINED_SHORTFALL" }],
      drawer_readiness: [{ state: "needs_count" }],
    });
  });

  it("parses versioned frozen evidence without reconstructing older snapshots", () => {
    const current = parseDayCloseSnapshotData({
      period_start_at: "2026-09-25T00:00:00Z",
      period_end_at: "2026-09-26T00:00:00Z",
      evidence: {
        schema_version: "day-close.evidence.v1",
        frozen: true,
        frozen_at: "2026-09-26T00:00:00Z",
        period: {
          restaurant_id: 7,
          business_line: "restaurant",
          period_start_at: "2026-09-25T00:00:00Z",
          period_end_at: "2026-09-26T00:00:00Z",
        },
        provenance: { operational: "canonical-operational.v1" },
        financial: {
          source: "finance_core",
          ledger_source: "finance_events",
          ledger_complete: true,
          fallback_applied: false,
          warnings: [],
        },
        operational: {
          contract_version: "canonical-operational.v1",
          generated_at: "2026-09-26T00:00:00Z",
          orders: {},
          items: {},
          categories: {},
          tables: {},
          hourly: {},
          customers: {},
          staff: {},
          cashiers: {},
          purchasing: {},
          warnings: [],
        },
        availability: { orders: "AVAILABLE" },
        warnings: [],
      },
    });
    const legacy = parseDayCloseSnapshotData({
      gross_sales: 100,
      orders: [],
    });

    expect(current?.evidence?.frozen).toBe(true);
    expect(current?.evidence?.availability.orders).toBe("AVAILABLE");
    expect(legacy?.evidence).toBeUndefined();
  });
});
