import { EntitlementGate } from "@/components/subscription/entitlement-gate";

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementGate
      entitlement="finance.income_expense.enabled"
      legacyFallback
      title="Expense tracking is not included in your plan"
    >
      {children}
    </EntitlementGate>
  );
}
