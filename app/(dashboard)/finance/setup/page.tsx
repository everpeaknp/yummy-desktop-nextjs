import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  Landmark,
  LayoutGrid,
  ListTree,
  Percent,
  Settings2,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";

type SetupItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const setupGroups: Array<{ label: string; items: SetupItem[] }> = [
  {
    label: "Accounting structure",
    items: [
      {
        title: "Chart of Accounts",
        description:
          "Manage the categories used when recording income and expenses.",
        href: "/finance/heads",
        icon: ListTree,
      },
      {
        title: "Stations / Departments",
        description:
          "Manage reporting dimensions used by menu, inventory, expense, and income entries.",
        href: "/manage/stations",
        icon: LayoutGrid,
      },
    ],
  },
  {
    label: "Money handling",
    items: [
      {
        title: "Cash & bank accounts",
        description:
          "Create, archive, and review the accounts that hold money.",
        href: "/finance/operations?tab=accounts",
        icon: Landmark,
      },
      {
        title: "Payment instruments",
        description:
          "Configure terminals, QR codes, wallets, and settlement accounts.",
        href: "/finance/operations?tab=payment-instruments",
        icon: WalletCards,
      },
      {
        title: "Cash drawers",
        description:
          "Configure tills, cashiers, float rules, and closing behavior.",
        href: "/finance/operations?tab=cash-drawers",
        icon: Banknote,
      },
    ],
  },
  {
    label: "Tax and control",
    items: [
      {
        title: "Taxes & fees",
        description: "Open the canonical tax and fee configuration workspace.",
        href: "/manage/taxes",
        icon: Percent,
      },
      {
        title: "Finance reports",
        description: "Review statements, control reports, and reconciliation.",
        href: "/finance/reports",
        icon: Settings2,
      },
    ],
  },
];

export default function FinanceSetupPage() {
  return (
    <AppPage width="standard" density="compact">
      <PageHeader
        title="Finance setup"
        description="Maintain accounting structure and money-handling configuration. Taxes and fees remain owned by their canonical settings workspace."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {setupGroups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold">{group.label}</h2>
            <div className="divide-y overflow-hidden rounded-2xl border bg-card">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-[68px] items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppPage>
  );
}
