import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ReservationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="reservations.enabled"
      legacyFallback
      title="Reservations are not included in your plan"
      description="Choose a plan that includes reservations to manage guest bookings and table assignments."
    >
      {children}
    </EntitlementGate>
  );
}
