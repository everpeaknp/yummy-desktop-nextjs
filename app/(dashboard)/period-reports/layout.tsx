import type { ReactNode } from "react";

import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function LegacyPeriodReportsLayout({ children }: { children: ReactNode }) {
  return (
    <EntitlementGate entitlement="finance.period_close.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
