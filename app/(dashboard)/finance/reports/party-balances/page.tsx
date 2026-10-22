import type { Metadata } from "next";

import { ReportingLedgerReportClient } from "@/components/finance/reports/reporting-ledger-report-client";

export const metadata: Metadata = { title: "Party Balances | Yummy Finance" };

export default function PartyBalancesReportPage() {
  return <ReportingLedgerReportClient mode="party-balances" />;
}
