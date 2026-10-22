import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="kitchen.kot.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
