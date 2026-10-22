import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Balance Sheet | Yummy Finance" };

export default function BalanceSheetReportPage() {
  return <ReportingLedgerReportClient mode="balance-sheet" />;
}
