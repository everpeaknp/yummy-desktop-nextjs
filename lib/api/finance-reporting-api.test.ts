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
import { AccountingApis } from "@/lib/api/endpoints";
import { financeReportingApi } from "./finance-reporting-api";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue({ data: { data: {} } });
});

describe("financeReportingApi reports", () => {
  it("uses only independent reporting-ledger report routes", async () => {
    const period = {
      date_from: "2026-08-01",
      date_to: "2026-08-21",
      business_line: "restaurant",
    };

    await financeReportingApi.getProfitAndLoss(period);
    await financeReportingApi.getTrialBalance({ ...period, include_zero: true });
    await financeReportingApi.getBalanceSheet({
      as_of_date: "2026-08-21",
      business_line: "restaurant",
    });
    await financeReportingApi.getAccountLedger(47, { ...period, limit: 100, offset: 0 });
    await financeReportingApi.getCustodyReconciliation({ business_line: "restaurant" });
    await financeReportingApi.getPartyBalances({
      as_of_date: "2026-08-21",
      party_type: "supplier",
      business_line: "restaurant",
    });
    await financeReportingApi.getCashFlow(period);
    await financeReportingApi.getHeadActivity({ ...period, include_zero: false });

    const paths = mocked.get.mock.calls.map(([path]) => path);
    expect(paths).toEqual([
      "/finance/reporting-reports/profit-and-loss",
      "/finance/reporting-reports/trial-balance",
      "/finance/reporting-reports/balance-sheet",
      "/finance/reporting-reports/account-ledger/47",
      "/finance/reporting-reports/custody-reconciliation",
      "/finance/reporting-reports/party-balances",
      "/finance/reporting-reports/cash-flow",
      "/finance/reporting-reports/head-activity",
    ]);
    for (const [, config] of mocked.get.mock.calls) {
      expect(config?.params).not.toHaveProperty("restaurant_id");
    }
  });

  it("points payment-bank and instrument helpers at independent finance routes", () => {
    expect(AccountingApis.paymentBanks(9)).toBe("/finance/payment-banks?restaurant_id=9");
    expect(AccountingApis.createPaymentBank()).toBe("/finance/payment-banks");
    expect(AccountingApis.updatePaymentBank(3)).toBe("/finance/payment-banks/3");
    expect(
      AccountingApis.paymentInstruments({
        restaurantId: 9,
        businessLine: "restaurant",
        activeOnly: false,
      }),
    ).toBe(
      "/finance/payment-instruments?restaurant_id=9&business_line=restaurant&active_only=false",
    );
    expect(AccountingApis.createPaymentInstrument()).toBe("/finance/payment-instruments");
    expect(AccountingApis.updatePaymentInstrument(4)).toBe("/finance/payment-instruments/4");
    expect(AccountingApis.deactivatePaymentInstrument(4)).toBe(
      "/finance/payment-instruments/4/deactivate",
    );
  });
});
