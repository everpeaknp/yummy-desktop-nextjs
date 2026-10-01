import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ManageReceiptDesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="designers.receipt.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
