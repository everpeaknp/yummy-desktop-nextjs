"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, FileText, Loader2 } from "lucide-react";

import { useRestaurant } from "@/hooks/use-restaurant";
import { type FinanceFeatureKey, isFinanceFeatureEnabled } from "@/lib/finance-feature-access";

const featureCopy: Record<FinanceFeatureKey, { title: string; description: string; icon: typeof BookOpen }> = {
  reports: {
    title: "Finance Reports are disabled",
    description: "This restaurant can still use daily finance tools, but reports are turned off from Yummy Admin.",
    icon: FileText,
  },
  accounting: {
    title: "Accounting is disabled",
    description: "This restaurant can still use day-to-day finance and cash controls, but the accounting workspace is turned off from Yummy Admin.",
    icon: BookOpen,
  },
};

export function FinanceFeatureLayoutGuard({
  feature,
  children,
}: {
  feature: FinanceFeatureKey;
  children: React.ReactNode;
}) {
  const restaurant = useRestaurant((state) => state.restaurant);
  const loading = useRestaurant((state) => state.loading);

  if (!restaurant && loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (isFinanceFeatureEnabled(restaurant, feature)) {
    return <>{children}</>;
  }

  const copy = featureCopy[feature];
  const Icon = copy.icon;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{copy.description}</p>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ask a Yummy Admin to enable this module for the restaurant if it should be available.</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/finance/income"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Go to Finance
          </Link>
          <Link
            href="/day-close"
            className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Open Day Close
          </Link>
        </div>
      </div>
    </div>
  );
}
