import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ManageKotDesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="designers.kot.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
