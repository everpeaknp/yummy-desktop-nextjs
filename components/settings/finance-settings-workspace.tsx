"use client";

import Link from "next/link";
import {
  Banknote,
  Landmark,
  LayoutGrid,
  ListTree,
  Percent,
  WalletCards,
} from "lucide-react";

import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { useRestaurant } from "@/hooks/use-restaurant";

const financeDestinations = [
  {
    title: "Chart of accounts",
    description: "Income, expense, asset, liability, and equity accounts",
    href: "/finance/heads",
    icon: ListTree,
  },
  {
    title: "Stations and departments",
    description: "Reporting dimensions used across finance and operations",
    href: "/manage/stations",
    icon: LayoutGrid,
  },
];

const moneyDestinations = [
  {
    title: "Cash and bank accounts",
    description: "Accounts that hold and settle money",
    href: "/finance/operations?tab=accounts",
    icon: Landmark,
  },
  {
    title: "Payment instruments",
    description: "Terminals, QR codes, wallets, and settlement accounts",
    href: "/finance/operations?tab=payment-instruments",
    icon: WalletCards,
  },
  {
    title: "Cash drawers",
    description: "Tills, cashier access, float rules, and closing controls",
    href: "/finance/operations?tab=cash-drawers",
    icon: Banknote,
  },
];

function DestinationList({ items }: { items: typeof financeDestinations }) {
  return (
    <DataList>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="block">
            <ListRow
              leading={<Icon className="h-4 w-4" />}
              title={item.title}
              description={item.description}
              interactive
            />
          </Link>
        );
      })}
    </DataList>
  );
}

export function FinanceSettingsWorkspace() {
  const restaurant = useRestaurant((state) => state.restaurant);
  const loading = useRestaurant((state) => state.loading);
  const error = useRestaurant((state) => state.error);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId="finance_setup" />
        <main className="min-w-0 flex-1">
          <PageHeader
            title="Finance setup"
            description="Configure financial structure and the tools used to receive, hold, and reconcile money."
          />

          {loading && !restaurant ? (
            <LoadingState label="Loading finance settings" className="mt-6" />
          ) : error && !restaurant ? (
            <ErrorState
              className="mt-6"
              title="Finance settings could not be loaded"
              description={error}
              actionLabel="Try again"
              onAction={() => void fetchRestaurant(true)}
            />
          ) : (
            <div className="mt-6 max-w-4xl space-y-8">
              <section className="space-y-3" aria-labelledby="finance-identity">
                <div>
                  <h2 id="finance-identity" className="text-lg font-semibold">
                    Financial identity
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Currency is owned by Finance and used throughout reports,
                    transactions, and checkout.
                  </p>
                </div>
                <DataList>
                  <ListRow
                    leading={<Landmark className="h-4 w-4" />}
                    title="Currency"
                    description="Configured reporting and transaction currency"
                    value={
                      <span className="font-medium tabular-nums">
                        {restaurant?.currency || "NPR"}
                      </span>
                    }
                  />
                </DataList>
              </section>

              <section
                className="space-y-3"
                aria-labelledby="accounting-structure"
              >
                <div>
                  <h2
                    id="accounting-structure"
                    className="text-lg font-semibold"
                  >
                    Accounting structure
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage accounts and reporting dimensions in their
                    finance-owned workspaces.
                  </p>
                </div>
                <DestinationList items={financeDestinations} />
              </section>

              <section className="space-y-3" aria-labelledby="money-handling">
                <div>
                  <h2 id="money-handling" className="text-lg font-semibold">
                    Money handling
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure where payments are received and how cash is
                    controlled.
                  </p>
                </div>
                <DestinationList items={moneyDestinations} />
              </section>

              <section className="space-y-3" aria-labelledby="tax-and-payments">
                <div>
                  <h2 id="tax-and-payments" className="text-lg font-semibold">
                    Tax and payment providers
                  </h2>
                </div>
                <DataList>
                  <Link href="/settings/taxes" className="block">
                    <ListRow
                      leading={<Percent className="h-4 w-4" />}
                      title="Taxes & fees"
                      description="Tax calculation applied to new orders"
                      interactive
                    />
                  </Link>
                  <Link href="/settings/payment-integrations" className="block">
                    <ListRow
                      leading={<WalletCards className="h-4 w-4" />}
                      title="Payment integrations"
                      description="Payment providers and QR configuration"
                      interactive
                    />
                  </Link>
                </DataList>
              </section>
            </div>
          )}
        </main>
      </div>
    </AppPage>
  );
}
