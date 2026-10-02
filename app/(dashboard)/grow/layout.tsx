import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function GrowLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="grow.enabled"
      title="Yummy Grow is not enabled for this restaurant"
      description="Yummy Grow is an optional customer-retention product. Review your plan or contact Yummy before using customer campaigns."
    >
      {children}
    </EntitlementGate>
  );
}
