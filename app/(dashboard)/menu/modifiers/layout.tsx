import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ModifierLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="menu.modifiers.enabled"
      legacyFallback
      title="Menu modifiers are not included in your plan"
      description="Choose a plan that includes modifiers to configure sizes, extras, and item choices."
    >
      {children}
    </EntitlementGate>
  );
}
