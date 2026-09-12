"use client";

import * as React from "react";
import { Banknote, Clock3, Package, Plus, ReceiptText, RefreshCw, ShoppingBag } from "lucide-react";

import { MetricCard } from "@/components/cards/metric-card";
import { OperationalCard } from "@/components/cards/operational-card";
import { SummaryCard } from "@/components/cards/summary-card";
import { AdaptiveFloatingAction } from "@/components/patterns/actions/adaptive-floating-action";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { ResponsiveDataView, type ResponsiveColumn } from "@/components/patterns/data/responsive-data-view";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/feedback/feedback-state";
import { PageTabs } from "@/components/patterns/navigation/page-tabs";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { PageSection } from "@/components/patterns/page/page-section";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportSummary } from "@/components/reports/report-summary";
import { Button } from "@/components/ui/button";

interface SaleRow {
  id: number;
  reference: string;
  customer: string;
  time: string;
  amount: string;
  status: string;
}

const sales: SaleRow[] = [
  { id: 1048, reference: "INV-1048", customer: "Walk-in guest", time: "12:42 PM", amount: "NPR 1,850", status: "Paid" },
  { id: 1047, reference: "INV-1047", customer: "Table G4", time: "12:31 PM", amount: "NPR 975", status: "Pending" },
  { id: 1046, reference: "INV-1046", customer: "Sanjay Shrestha", time: "12:18 PM", amount: "NPR 2,420", status: "Paid" },
];

const columns: ResponsiveColumn<SaleRow>[] = [
  { key: "reference", header: "Reference", cell: (row) => <span className="font-medium">{row.reference}</span> },
  { key: "customer", header: "Customer", cell: (row) => row.customer },
  { key: "time", header: "Time", cell: (row) => <span className="tabular-nums text-muted-foreground">{row.time}</span> },
  { key: "status", header: "Status", cell: (row) => <span className={row.status === "Paid" ? "text-emerald-600" : "text-amber-600"}>{row.status}</span> },
  { key: "amount", header: "Amount", headerClassName: "text-right", className: "text-right font-semibold tabular-nums", cell: (row) => row.amount },
];

const tabItems = [
  { value: "overview", label: "Overview" },
  { value: "orders", label: "Orders", count: 12 },
  { value: "payments", label: "Payments" },
  { value: "activity", label: "Activity" },
];

export function WebUiGallery() {
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState("overview");
  const [filter, setFilter] = React.useState("all");
  const filters = (
    <div className="flex flex-wrap gap-2">
      <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
      <FilterChip active={filter === "paid"} count={8} onClick={() => setFilter("paid")}>Paid</FilterChip>
      <FilterChip active={filter === "pending"} count={4} onClick={() => setFilter("pending")}>Pending</FilterChip>
    </div>
  );

  return (
    <AppPage width="wide" className="pb-16">
      <PageHeader
        title="Yummy web UI system"
        description="Development gallery for the shared Next.js layout, control, data and feedback patterns."
        actions={<Button className="h-11 rounded-xl"><Plus className="mr-2 h-4 w-4" />Primary action</Button>}
      />

      <PageSection title="Page controls" description="Search, filters and tabs share one mobile interaction contract." surface>
        <div className="space-y-3">
          <div className="flex min-w-0 gap-2">
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search orders, customers or references"
              containerClassName="min-w-0 flex-1"
            />
            <Button variant="outline" size="icon" aria-label="Refresh" className="h-11 w-11 shrink-0 rounded-xl border shadow-none"><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <FilterBar title="Order filters" activeCount={filter === "all" ? 0 : 1} mobileContent={filters}>{filters}</FilterBar>
          <PageTabs items={tabItems} value={tab} onValueChange={setTab} mobileMode="equal" />
        </div>
      </PageSection>

      <PageSection title="Metrics" description="Compact, scannable summaries that do not dominate a phone viewport.">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <MetricCard label="Net sales" value="NPR 27,633" icon={<Banknote className="h-4 w-4" />} tone="brand" detail="Today" trend="+8.2%" />
          <MetricCard label="Orders" value="97" icon={<ReceiptText className="h-4 w-4" />} tone="info" detail="12 active" />
          <MetricCard label="Average order" value="NPR 285" icon={<ShoppingBag className="h-4 w-4" />} tone="success" detail="Per completed order" />
          <MetricCard label="Pending" value="4" icon={<Clock3 className="h-4 w-4" />} tone="warning" detail="Needs attention" />
        </div>
      </PageSection>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <PageSection title="Operational cards" description="Dense enough for active work, with hierarchy reserved for status and value.">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <OperationalCard title="Garden G4" status={<span className="text-amber-600">Pending</span>} meta="#1047 · 12 minutes">
              <div className="space-y-1"><div className="flex justify-between"><span>Iced Americano</span><span>×1</span></div><div className="flex justify-between"><span>Chicken momo</span><span>×2</span></div></div>
            </OperationalCard>
            <OperationalCard title="Pickup 18" status={<span className="text-emerald-600">Ready</span>} meta="#1044 · Mina Rai" selected>
              <div className="space-y-1"><div className="flex justify-between"><span>Veg thukpa</span><span>×1</span></div><div className="flex justify-between"><span>Lemon soda</span><span>×1</span></div></div>
            </OperationalCard>
          </div>
        </PageSection>

        <PageSection title="Grouped lists" description="Consistent row rhythm for management and settings pages.">
          <DataList>
            <ListRow leading={<Package className="h-4 w-4" />} title="Food inventory" description="225 tracked items" meta="12 low" interactive />
            <ListRow leading={<ReceiptText className="h-4 w-4" />} title="Purchases" description="Supplier invoices and returns" meta="NPR 18,400" interactive />
            <ListRow leading={<Banknote className="h-4 w-4" />} title="Cash drawers" description="Open sessions and reconciliation" interactive />
          </DataList>
        </PageSection>
      </div>

      <PageSection title="Responsive data" description="Cards on mobile; a bounded table on larger screens.">
        <ResponsiveDataView
          data={sales}
          columns={columns}
          getKey={(row) => row.id}
          renderMobileItem={(row) => (
            <OperationalCard title={row.reference} status={<span className={row.status === "Paid" ? "text-emerald-600" : "text-amber-600"}>{row.status}</span>} meta={`${row.customer} · ${row.time}`}>
              <div className="font-semibold tabular-nums">{row.amount}</div>
            </OperationalCard>
          )}
        />
      </PageSection>

      <PageSection title="Report composition" description="A shared report hierarchy with compact filters and summaries." surface>
        <ReportHeader title="Sales register" description="Operational sales, payments and adjustments." period="Today, 12:00 AM – now" context={["All stations", "Restaurant"]} />
        <ReportFilters className="mt-4" title="Report filters" mobileContent={filters}>{filters}</ReportFilters>
        <ReportSummary className="mt-4" metrics={[
          { key: "sales", label: "Gross sales", value: "NPR 31,248", tone: "brand" },
          { key: "refunds", label: "Refunds", value: "NPR 1,569", tone: "danger" },
          { key: "net", label: "Net sales", value: "NPR 29,679", tone: "success" },
          { key: "count", label: "Transactions", value: "104", tone: "info" },
        ]} />
      </PageSection>

      <PageSection title="Feedback states">
        <div className="grid gap-3 md:grid-cols-3">
          <LoadingState label="Loading transactions" className="rounded-2xl border border-border" />
          <EmptyState title="No returns found" description="Returns matching these filters will appear here." />
          <ErrorState title="Could not load sales" description="Check the connection and try again." actionLabel="Try again" onAction={() => undefined} />
        </div>
      </PageSection>

      <SummaryCard title="Adaptive action" description="Within pages, the action expands when context matters and compacts after scrolling.">
        <div className="relative h-28 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
          <AdaptiveFloatingAction placement="contained" mobileOnly={false} label="New order" icon={<Plus className="h-5 w-5" />} onClick={() => undefined} />
        </div>
      </SummaryCard>
    </AppPage>
  );
}
