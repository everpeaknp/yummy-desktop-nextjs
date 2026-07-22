import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="inventory.enabled"
      legacyFallback
      title="Inventory is not included in your plan"
      description="Choose a plan that includes inventory management to use stock, valuation, and adjustment workflows."
    >
      {children}
    </EntitlementGate>
  );
}
