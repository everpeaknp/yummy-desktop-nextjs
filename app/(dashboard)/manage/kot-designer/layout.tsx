import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function KotDesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="designers.kot.enabled"
      legacyFallback
      title="KOT designer is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
