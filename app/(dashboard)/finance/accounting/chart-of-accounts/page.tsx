import { redirect } from "next/navigation";

export default function ChartOfAccountsPage() {
  // The reporting-head hierarchy is the one canonical Chart of Accounts.
  // Keep this legacy URL working for saved links without maintaining a second UI.
  redirect("/finance/heads");
}
