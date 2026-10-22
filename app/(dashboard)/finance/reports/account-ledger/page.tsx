import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Account Ledger | Yummy Finance" };

export default function AccountLedgerReportPage() {
  return <ReportingLedgerReportClient mode="account-ledger" />;
}
