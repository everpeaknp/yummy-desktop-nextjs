import { Banknote, Landmark, ListTree, Percent, Settings2, WalletCards } from "lucide-react";
import { FinanceModuleHub } from "@/components/finance/workspace/finance-module-hub";

export default function FinanceSetupPage() {
  return (
    <FinanceModuleHub
      eyebrow="Finance"
      title="Finance setup"
      description="Configuration is kept away from daily transaction screens. A payment instrument describes how a customer pays; its linked account describes where the money settles."
      items={[
        { title: "Financial categories", description: "Manage reporting heads, groups, mappings, and opening balances.", href: "/finance/heads", icon: ListTree },
        { title: "Cash & bank accounts", description: "Create, rename, archive, and review custody accounts.", href: "/finance/operations?tab=accounts", icon: Landmark },
        { title: "Payment instruments", description: "Configure terminals, static QR codes, wallets, and their settlement account.", href: "/finance/operations?tab=payment-instruments", icon: WalletCards },
        { title: "Cash drawers", description: "Configure tills, cashiers, float rules, and closing behavior.", href: "/cash-drawers", icon: Banknote },
        { title: "Tax & rates", description: "Manage tax rates used by billing and financial reports.", href: "/manage/taxes", icon: Percent },
        { title: "Finance controls", description: "Review module availability, close periods, and advanced controls.", href: "/finance/reports", icon: Settings2 },
      ]}
    />
  );
}
