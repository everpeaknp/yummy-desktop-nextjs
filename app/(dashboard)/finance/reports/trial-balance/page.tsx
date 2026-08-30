import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Trial Balance | Yummy Finance" };

export default function TrialBalanceReportPage() {
  return <ReportingLedgerReportClient mode="trial-balance" />;
}
