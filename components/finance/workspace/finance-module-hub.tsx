import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { Card, CardContent } from "@/components/ui/card";

export type FinanceModuleHubItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export function FinanceModuleHub({
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
    <AppPage width="standard" density="compact">
      <PageHeader title={title} description={description} />

      <div className="overflow-hidden rounded-2xl border bg-background sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:border-0 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group block border-b last:border-b-0 sm:border-0"
            >
              <Card className="h-full rounded-none border-0 shadow-none transition-colors group-hover:bg-muted/40 sm:rounded-2xl sm:border sm:group-hover:border-primary/30">
                <CardContent className="flex min-h-[72px] items-center gap-3 p-3 sm:min-h-0 sm:items-start sm:p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 font-semibold">{item.title}</p>
                      {item.badge ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{item.badge}</span> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground sm:mt-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppPage>
  );
}
