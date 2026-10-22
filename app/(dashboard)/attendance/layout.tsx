import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="attendance.enabled" title="Unlock attendance">
      {children}
    </EntitlementGate>
  );
}
