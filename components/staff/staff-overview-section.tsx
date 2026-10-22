"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";

import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { WorkforceSection } from "@/components/workforce/workforce-presentation";
import { cn } from "@/lib/utils";

export type StaffOverviewRow = {
  label: string;
  value: string;
  icon?: LucideIcon;
  attention?: boolean;
};

function OverviewRows({
  items,
  stacked = false,
}: {
  items: StaffOverviewRow[];
  stacked?: boolean;
}) {
  return (
    <DataList className="rounded-none border-x-0 bg-transparent">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <ListRow
            key={item.label}
            leading={Icon ? <Icon className="h-4 w-4" /> : undefined}
            title={item.label}
            description={stacked ? item.value : undefined}
            trailing={
              stacked ? undefined : (
                <span
                  className={cn(
                    "text-right text-sm font-semibold tabular-nums",
                    item.attention && "text-amber-700 dark:text-amber-400",
                  )}
                >
                  {item.value}
                </span>
              )
            }
          />
        );
      })}
    </DataList>
  );
}

export function StaffOverviewSection({
  today,
  periodLabel,
  metrics,
  employment,
  needsAttention,
  attentionTitle,
  attentionDescription,
  todayUnavailable = false,
}: {
  today: StaffOverviewRow[];
  periodLabel: string;
  metrics: StaffOverviewRow[];
  employment: StaffOverviewRow[];
  needsAttention: boolean;
  attentionTitle: string;
  attentionDescription: string;
  todayUnavailable?: boolean;
}) {
  return (
    <section
      aria-label="Overview"
      className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]"
    >
      <div className="min-w-0 space-y-6">
        <WorkforceSection title="Today">
          {todayUnavailable ? (
            <p className="border-y py-3 text-sm text-muted-foreground">
              Today&apos;s attendance is unavailable for your access level.
            </p>
          ) : null}
          {today.length ? <OverviewRows items={today} stacked /> : null}
        </WorkforceSection>

        <WorkforceSection title="This period" description={periodLabel}>
          {metrics.length ? (
            <OverviewRows items={metrics} />
          ) : (
            <p className="border-y py-3 text-sm text-muted-foreground">
              Attendance summary is unavailable for your access level.
            </p>
          )}
        </WorkforceSection>
      </div>

      <aside className="min-w-0 space-y-6">
        <WorkforceSection title="Employment">
          <OverviewRows items={employment} />
        </WorkforceSection>

        {needsAttention ? (
          <WorkforceSection title="Needs attention">
            <div className="flex items-start gap-3 border-l-2 border-amber-500 py-1 pl-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">{attentionTitle}</p>
                <p className="mt-1 leading-5 text-muted-foreground">
                  {attentionDescription}
                </p>
              </div>
            </div>
          </WorkforceSection>
        ) : null}
      </aside>
    </section>
  );
}
