import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="inventory.suppliers.enabled"
      legacyFallback
      title="Supplier management is not included in your plan"
      description="Choose a plan that includes suppliers to manage purchasing contacts and balances."
    >
      {children}
    </EntitlementGate>
  );
}
