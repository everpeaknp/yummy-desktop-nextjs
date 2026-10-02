import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Cash Flow | Yummy Finance" };

export default function CashFlowReportPage() {
  return <ReportingLedgerReportClient mode="cash-flow" />;
}
