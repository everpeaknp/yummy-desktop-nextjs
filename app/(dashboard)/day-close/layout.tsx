import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function DayCloseLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="finance.daybook.enabled"
      legacyFallback
      title="Day close is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
