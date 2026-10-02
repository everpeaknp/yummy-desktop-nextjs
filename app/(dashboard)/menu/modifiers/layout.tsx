import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ModifierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EntitlementGate entitlement="menu.modifiers.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
