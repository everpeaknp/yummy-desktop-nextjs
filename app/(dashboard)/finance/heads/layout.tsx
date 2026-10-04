import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function FinanceHeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="finance.accounting.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
