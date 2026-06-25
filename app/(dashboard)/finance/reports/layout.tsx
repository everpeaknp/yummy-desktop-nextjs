import { FinanceFeatureLayoutGuard } from "@/components/finance/finance-feature-layout-guard";

export default function FinanceReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceFeatureLayoutGuard feature="reports">{children}</FinanceFeatureLayoutGuard>;
}
