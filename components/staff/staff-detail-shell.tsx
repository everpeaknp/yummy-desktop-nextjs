"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  History,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/patterns/page/page-header";
import { PageTabs } from "@/components/patterns/navigation/page-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StaffDetailSection =
  | "overview"
  | "attendance"
  | "financials"
  | "performance"
  | "employment"
  | "access"
  | "activity";

type StaffSectionDefinition = {
  value: StaffDetailSection;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const staffDetailSections: StaffSectionDefinition[] = [
  {
    value: "overview",
    label: "Overview",
    description: "What needs attention now",
    icon: LayoutDashboard,
  },
  {
    value: "attendance",
    label: "Attendance",
    description: "Timesheets, schedule, and leave",
    icon: Clock3,
  },
  {
    value: "financials",
    label: "Financials",
    description: "Pay, overtime, and advances",
    icon: WalletCards,
  },
  {
    value: "performance",
    label: "Performance",
    description: "Order and service performance",
    icon: BarChart3,
  },
  {
    value: "employment",
    label: "Employment",
    description: "Profile, pay setup, and lifecycle",
    icon: BriefcaseBusiness,
  },
  {
    value: "access",
    label: "Access",
    description: "Role, permissions, and restrictions",
    icon: ShieldCheck,
  },
  {
    value: "activity",
    label: "Activity",
    description: "Attendance and compensation history",
    icon: History,
  },
];

export function normalizeStaffDetailSection(
  value: string | null,
  allowedSections: StaffDetailSection[],
): StaffDetailSection {
  const normalized = value === "payroll" ? "financials" : value;
  return allowedSections.includes(normalized as StaffDetailSection)
    ? (normalized as StaffDetailSection)
    : "overview";
}

export function StaffIdentityHeader({
  name,
  active,
  role,
  reference,
  canEdit,
  refreshing,
  onEdit,
  onRefresh,
}: {
  name: string;
  active: boolean;
  role: string;
  reference?: string | null;
  canEdit: boolean;
  refreshing: boolean;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const avatar = (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
      {name.charAt(0).toUpperCase() || "?"}
    </div>
  );

  return (
    <header className="border-b pb-3">
      <div className="lg:hidden">
        <div className="flex min-w-0 items-start gap-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {name}
              </h1>
              <Badge variant={active ? "default" : "secondary"}>
                {active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm font-medium">{role}</p>
            {reference ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {reference}
              </p>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <Button className="mt-3 h-11 w-full" onClick={onEdit}>
            Edit staff
          </Button>
        ) : null}
      </div>

      <PageHeader
        className="hidden lg:flex"
        title={name}
        leading={avatar}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{role}</span>
            {reference ? <span>{reference}</span> : null}
          </span>
        }
        meta={
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        }
        actions={
          <>
            {canEdit ? <Button onClick={onEdit}>Edit staff</Button> : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              disabled={refreshing}
              onClick={onRefresh}
              aria-label="Refresh staff details"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </>
        }
      />
    </header>
  );
}

export function StaffMobileSectionNav({
  activeSection,
  allowedSections,
  onSectionChange,
}: {
  activeSection: StaffDetailSection;
  allowedSections: StaffDetailSection[];
  onSectionChange: (section: StaffDetailSection) => void;
}) {
  const availableSections = staffDetailSections.filter((section) =>
    allowedSections.includes(section.value),
  );

  return (
    <nav aria-label="Staff detail sections" className="lg:hidden">
      <PageTabs
        value={activeSection}
        onValueChange={(value) => onSectionChange(value as StaffDetailSection)}
        mobileMode="scroll"
        ariaLabel="Staff detail sections"
        items={availableSections.map((section) => ({
          value: section.value,
          label: section.label,
        }))}
      />
    </nav>
  );
}

export function StaffDesktopSectionNav({
  activeSection,
  allowedSections,
  onSectionChange,
}: {
  activeSection: StaffDetailSection;
  allowedSections: StaffDetailSection[];
  onSectionChange: (section: StaffDetailSection) => void;
}) {
  return (
    <nav
      aria-label="Staff detail sections"
      className="sticky top-24 hidden self-start lg:block"
    >
      <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
        Staff workspace
      </p>
      <div className="space-y-1">
        {staffDetailSections
          .filter((section) => allowedSections.includes(section.value))
          .map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.value;
            return (
              <button
                key={section.value}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSectionChange(section.value)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
      </div>
    </nav>
  );
}

export function StaffSectionHeading({
  section,
}: {
  section: StaffDetailSection;
}) {
  const definition = staffDetailSections.find(
    (item) => item.value === section,
  )!;
  return (
    <div className="border-b pb-3">
      <h2 className="text-xl font-semibold tracking-tight">
        {definition.label}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {definition.description}
      </p>
    </div>
  );
}

export function StaffDetailContent({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-5">{children}</div>;
}
