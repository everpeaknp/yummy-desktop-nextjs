import { Metadata } from "next";
import { AccountHeadsClient } from "@/components/finance/heads/account-heads-client";

export const metadata: Metadata = {
  title: "Account Heads | Yummy Finance",
  description:
    "Manage Chart of Accounts reporting heads, groups, and opening balances.",
};

export default function AccountHeadsPage() {
  return (
    <div className="flex flex-col gap-4">
      <AccountHeadsClient />
    </div>
  );
}
