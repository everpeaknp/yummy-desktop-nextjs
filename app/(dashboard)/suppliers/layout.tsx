import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="inventory.suppliers.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
