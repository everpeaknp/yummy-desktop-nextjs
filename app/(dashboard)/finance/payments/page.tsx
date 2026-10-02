import { FinancePaymentsClient } from "@/components/finance/workspace/finance-payments-client";
import { FinanceFeatureLayoutGuard } from "@/components/finance/finance-feature-layout-guard";

export default function FinancePaymentsPage() {
  // Payments is a finance-report view. Keep the route behind the same client
  // guard as the rest of Finance Reports so disabled restaurants do not issue
  // a request that the backend must reject with 403.
  return (
    <FinanceFeatureLayoutGuard feature="reports">
      <FinancePaymentsClient />
    </FinanceFeatureLayoutGuard>
  );
}
