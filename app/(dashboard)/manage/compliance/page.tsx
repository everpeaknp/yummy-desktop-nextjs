import { redirect } from "next/navigation";

/**
 * Fiscal activation and CBMS credentials are platform-operator workflows.
 * Keep old tenant bookmarks safe, but do not expose the configuration screen
 * in the restaurant application.
 */
export default function CompliancePage() {
  redirect("/manage");
}
