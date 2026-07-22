import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="business.hotel.enabled"
      legacyFallback
      title="Hotel management is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
