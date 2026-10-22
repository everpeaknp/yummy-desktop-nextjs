import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Profit & Loss | Yummy Finance" };

export default function ProfitAndLossReportPage() {
  return <ReportingLedgerReportClient mode="profit-and-loss" />;
}
