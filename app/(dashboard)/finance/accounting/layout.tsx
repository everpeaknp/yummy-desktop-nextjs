import { FinanceFeatureLayoutGuard } from "@/components/finance/finance-feature-layout-guard";
import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function FinanceAccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EntitlementGate
      entitlement="finance.accounting.enabled"
      legacyFallback
      title="Accounting is not included in your plan"
      description="Full accounting is controlled by your subscription or an assigned accounting add-on."
    >
      <FinanceFeatureLayoutGuard feature="accounting">{children}</FinanceFeatureLayoutGuard>
    </EntitlementGate>
  );
}
