import { redirect } from "next/navigation";

// Legacy weekly/monthly period closes have been retired in favour of the
// current finance reports and accounting-period controls.
export default function LegacyPeriodReportsPage() {
  redirect("/finance/reports");
}
