import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ReceiptDesignerSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EntitlementGate
      entitlement="designers.receipt.enabled"
      legacyFallback
      title="Receipt designer is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
