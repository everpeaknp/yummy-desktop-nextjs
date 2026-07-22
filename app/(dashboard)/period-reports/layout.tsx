import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function PeriodReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="finance.period_close.enabled"
      legacyFallback
      title="Period reports are not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
