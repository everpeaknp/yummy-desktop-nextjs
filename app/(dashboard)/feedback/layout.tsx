import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate entitlement="customers.feedback.enabled" legacyFallback>
      {children}
    </EntitlementGate>
  );
}
