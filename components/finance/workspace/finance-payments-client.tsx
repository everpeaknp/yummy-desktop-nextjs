"use client";

import { OperationalFinanceReportClient } from "@/components/finance/reports/operational-finance-report-client";

export function FinancePaymentsClient() {
  return <OperationalFinanceReportClient mode="payments" showReportNavigation={false} />;
}
