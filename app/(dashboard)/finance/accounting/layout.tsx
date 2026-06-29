import { FinanceFeatureLayoutGuard } from "@/components/finance/finance-feature-layout-guard";

export default function FinanceAccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceFeatureLayoutGuard feature="accounting">{children}</FinanceFeatureLayoutGuard>;
}
