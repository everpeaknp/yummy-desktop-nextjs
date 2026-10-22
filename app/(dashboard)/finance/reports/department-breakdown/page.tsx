import type { Metadata } from "next";

import { DepartmentBreakdownReportClient } from "@/components/finance/reports/department-breakdown-report-client";

export const metadata: Metadata = { title: "Performance by Department | Yummy Finance" };

export default function DepartmentBreakdownReportPage() {
  return <DepartmentBreakdownReportClient />;
}
