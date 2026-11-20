import type { Metadata } from "next";
import { VatSummaryReportClient } from "@/components/finance/reports/vat-summary-report-client";

export const metadata: Metadata = { title: "VAT Summary | Yummy Finance" };

export default function VatSummaryReportPage() {
  return <VatSummaryReportClient />;
}
