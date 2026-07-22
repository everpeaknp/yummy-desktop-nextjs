import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="customers.crm.enabled"
      legacyFallback
      title="Customer CRM is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
