import { Metadata } from "next";
import { AccountHeadsClient } from "@/components/finance/heads/account-heads-client";

export const metadata: Metadata = {
  title: "Chart of Accounts | Yummy Finance",
  description:
    "Manage the categories you use when recording income and expenses.",
};

export default function AccountHeadsPage() {
  return (
    <div className="flex flex-col gap-4">
      <AccountHeadsClient />
    </div>
  );
}
