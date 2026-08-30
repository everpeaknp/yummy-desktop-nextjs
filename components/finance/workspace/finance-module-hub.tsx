import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export type FinanceModuleHubItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export function FinanceModuleHub({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: FinanceModuleHubItem[];
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full border-border shadow-none transition group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-sm">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    {item.badge ? <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{item.badge}</span> : null}
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 font-semibold">
                    {item.title}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
