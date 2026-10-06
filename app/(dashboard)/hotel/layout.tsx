import { EntitlementGate } from "@/components/subscription/entitlement-gate";
import { RoleGuard } from "@/components/auth/role-guard";

export default function HotelPmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="business.hotel.enabled"
      legacyFallback
      title="Hotel management is not included in your plan"
    >
      <RoleGuard>{children}</RoleGuard>
    </EntitlementGate>
  );
}
