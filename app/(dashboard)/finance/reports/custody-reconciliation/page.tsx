import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Custody Reconciliation | Yummy Finance" };

export default function CustodyReconciliationReportPage() {
  return <ReportingLedgerReportClient mode="custody-reconciliation" />;
}
