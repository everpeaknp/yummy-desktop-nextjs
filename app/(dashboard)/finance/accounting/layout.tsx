import { redirect } from "next/navigation";

export default function FinanceAccountingLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/finance/operations");
}
