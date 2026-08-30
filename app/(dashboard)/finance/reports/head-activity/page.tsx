import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Head Activity | Yummy Finance" };

export default function HeadActivityReportPage() {
  return <ReportingLedgerReportClient mode="head-activity" />;
}
