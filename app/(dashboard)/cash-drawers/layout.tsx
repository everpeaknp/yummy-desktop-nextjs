import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function CashDrawersLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="finance.cash_drawer.enabled"
      legacyFallback
      title="Cash drawers are not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
