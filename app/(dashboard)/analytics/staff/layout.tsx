import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function StaffAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="staff.performance.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
