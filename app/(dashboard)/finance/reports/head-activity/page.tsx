import { redirect } from "next/navigation";

export default function HeadActivityReportPage() {
  // Compatibility for bookmarked legacy report URLs. Accounts is the only
  // user-facing account-activity report.
  redirect("/finance/reports/account-ledger");
}
