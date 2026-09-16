"use client";

import * as React from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

import { OperationalCard } from "@/components/cards/operational-card";
import { SummaryCard } from "@/components/cards/summary-card";
import { AdaptiveFloatingAction } from "@/components/patterns/actions/adaptive-floating-action";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  DetailField,
  DetailGrid,
} from "@/components/patterns/data/detail-grid";
import {
  FinancialSummary,
  CompactMetric,
  MetricGrid,
} from "@/components/patterns/data/metric-grid";
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from "@/components/patterns/data/responsive-data-view";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { StatusBadge } from "@/components/patterns/feedback/status-badge";
import {
  FieldGroup,
  FormActions,
  FormSection,
} from "@/components/patterns/forms/form-section";
import { MobileAppBar } from "@/components/patterns/navigation/mobile-app-bar";
import { PageTabs } from "@/components/patterns/navigation/page-tabs";
import { SegmentedControl } from "@/components/patterns/navigation/segmented-control";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { PageSection } from "@/components/patterns/page/page-section";
import { Surface } from "@/components/patterns/surfaces/surface";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportSummary } from "@/components/reports/report-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatMoney, formatProductDate } from "@/lib/presentation-format";

interface SaleRow {
  id: number;
  reference: string;
  customer: string;
  time: string;
  amount: string;
  status: string;
}

const sales: SaleRow[] = [
  {
    id: 1048,
    reference: "INV-1048",
    customer: "Walk-in guest",
    time: "12:42 PM",
    amount: "NPR 1,850",
    status: "Paid",
  },
  {
    id: 1047,
    reference: "INV-1047",
    customer: "Table G4",
    time: "12:31 PM",
    amount: "NPR 975",
    status: "Pending",
  },
  {
    id: 1046,
    reference: "INV-1046",
    customer: "Sanjay Shrestha",
    time: "12:18 PM",
    amount: "NPR 2,420",
    status: "Paid",
  },
];

const columns: ResponsiveColumn<SaleRow>[] = [
  {
    key: "reference",
    header: "Reference",
    cell: (row) => <span className="font-medium">{row.reference}</span>,
  },
  { key: "customer", header: "Customer", cell: (row) => row.customer },
  {
    key: "time",
    header: "Time",
    cell: (row) => (
      <span className="tabular-nums text-muted-foreground">{row.time}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <span
        className={
          row.status === "Paid" ? "text-emerald-600" : "text-amber-600"
        }
      >
        {row.status}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    headerClassName: "text-right",
    className: "text-right font-semibold tabular-nums",
    cell: (row) => row.amount,
  },
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
  const [segment, setSegment] = React.useState("items");
  const filters = (
    <div className="flex flex-wrap gap-2">
      <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
        All
      </FilterChip>
      <FilterChip
        active={filter === "paid"}
        count={8}
        onClick={() => setFilter("paid")}
      >
        Paid
      </FilterChip>
      <FilterChip
        active={filter === "pending"}
        count={4}
        onClick={() => setFilter("pending")}
      >
        Pending
      </FilterChip>
    </div>
  );

  return (
    <AppPage width="standard" className="pb-16">
      <PageHeader
        title="Yummy web UI system"
        description="Development gallery for the shared Next.js layout, control, data and feedback patterns."
        actions={
          <Button className="h-11 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Primary action
          </Button>
        }
      />

      <PageSection
        title="App bars and actions"
        description="One mobile title/back treatment; action emphasis is intentional."
        surface
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,390px)_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Mobile preview — 390px logical width
            </p>
            <Surface kind="table" className="max-w-[390px] p-3">
              <MobileAppBar
                title="Manage"
                className="border-b border-border lg:flex"
              />
              <MobileAppBar
                title="Inventory"
                navigation="secondary"
                onBack={() => undefined}
                className="border-b border-border lg:flex"
              />
              <MobileAppBar
                title="Sale SI-015210"
                navigation="detail"
                onBack={() => undefined}
                className="lg:flex"
                actions={
                  <Button variant="ghost" className="h-11 px-3">
                    Edit
                  </Button>
                }
              />
            </Surface>
          </div>
          <div className="max-w-md">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Action hierarchy
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" className="h-11">
                Primary
              </Button>
              <Button variant="outline" className="h-11">
                Secondary
              </Button>
              <Button variant="ghost" className="h-11">
                Ghost
              </Button>
              <Button variant="tertiary" className="h-11">
                Tertiary
              </Button>
              <Button variant="text" className="h-11 justify-start">
                Inline action
              </Button>
              <Button variant="destructive" className="h-11">
                Destructive
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh"
                className="h-11 w-11"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Page controls"
        description="Search, filters and tabs share one mobile interaction contract."
        surface
      >
        <div className="space-y-3">
          <div className="flex min-w-0 gap-2">
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search orders, customers or references"
              containerClassName="min-w-0 flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh"
              className="h-11 w-11 shrink-0 rounded-xl border shadow-none"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <FilterBar
            title="Order filters"
            activeCount={filter === "all" ? 0 : 1}
            mobileContent={filters}
          >
            {filters}
          </FilterBar>
          <PageTabs
            items={tabItems}
            value={tab}
            onValueChange={setTab}
            mobileMode="scroll"
          />
        </div>
      </PageSection>

      <PageSection
        title="Metrics"
        description="Financial values favour readability; compact operational counts may use more density."
      >
        <p className="mb-2 text-sm font-medium text-foreground">
          Financial metrics
        </p>
        <MetricGrid density="financial">
          <CompactMetric
            label="Net sales"
            value="NPR 27,633"
            icon={<Banknote className="h-4 w-4" />}
            tone="brand"
            detail="Today"
            trend="+8.2%"
          />
          <CompactMetric
            label="Average order"
            value="NPR 285"
            icon={<ShoppingBag className="h-4 w-4" />}
            tone="success"
            detail="Per completed order"
          />
          <CompactMetric
            label="Gross sales"
            value="NPR 31,248"
            icon={<Banknote className="h-4 w-4" />}
            tone="info"
            detail="Before returns"
          />
        </MetricGrid>
        <p className="mb-2 mt-5 text-sm font-medium text-foreground">
          Compact operational counts
        </p>
        <MetricGrid density="compact">
          <CompactMetric
            label="Orders"
            value="97"
            icon={<ReceiptText className="h-4 w-4" />}
            tone="info"
            detail="12 active"
          />
          <CompactMetric
            label="Pending"
            value="4"
            icon={<Clock3 className="h-4 w-4" />}
            tone="warning"
            detail="Needs attention"
          />
        </MetricGrid>
        <FinancialSummary
          className="mt-3"
          label="Net sales"
          value={formatMoney(29679, { currency: "NPR" })}
          detail="Product UI formatter with tabular numerals"
        />
      </PageSection>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <PageSection
          title="Operational cards"
          description="Dense enough for active work, with hierarchy reserved for status and value."
        >
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <OperationalCard
              title="Garden G4"
              status={<span className="text-amber-600">Pending</span>}
              meta="#1047 · 12 minutes"
            >
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Iced Americano</span>
                  <span>×1</span>
                </div>
                <div className="flex justify-between">
                  <span>Chicken momo</span>
                  <span>×2</span>
                </div>
              </div>
            </OperationalCard>
            <OperationalCard
              title="Pickup 18"
              status={<span className="text-emerald-600">Ready</span>}
              meta="#1044 · Mina Rai"
              selected
            >
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Veg thukpa</span>
                  <span>×1</span>
                </div>
                <div className="flex justify-between">
                  <span>Lemon soda</span>
                  <span>×1</span>
                </div>
              </div>
            </OperationalCard>
          </div>
        </PageSection>

        <PageSection
          title="List row variants"
          description="Navigation, register, activity and entity rows share one dense rhythm."
        >
          <DataList>
            <ListRow
              leading={<Package className="h-4 w-4" />}
              title="Food inventory"
              description="Navigation row · 225 tracked items"
              meta="12 low"
              interactive
            />
            <ListRow
              leading={<ReceiptText className="h-4 w-4" />}
              title="SI-015210"
              description="Register row · Walk-in customer · 03 Sep"
              meta="NPR 730"
              interactive
            />
            <ListRow
              leading={<RefreshCw className="h-4 w-4" />}
              title="Stock count updated"
              description="Activity row · Main store"
              meta="2 min"
              interactive
            />
            <ListRow
              leading={<Banknote className="h-4 w-4" />}
              title="Mina Rai"
              description="Entity row · 12 orders · NPR 8,450 outstanding"
              interactive
            />
          </DataList>
        </PageSection>
      </div>

      <PageSection
        title="Responsive data"
        description="Register rows through tablet; a bounded table begins only when the workspace is desktop-sized."
      >
        <ResponsiveDataView
          data={sales}
          columns={columns}
          getKey={(row) => row.id}
          tableBreakpoint="desktop"
          renderMobileItem={(row) => (
            <OperationalCard
              title={row.reference}
              status={
                <span
                  className={
                    row.status === "Paid"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }
                >
                  {row.status}
                </span>
              }
              meta={`${row.customer} · ${row.time}`}
            >
              <div className="font-semibold tabular-nums">{row.amount}</div>
            </OperationalCard>
          )}
        />
      </PageSection>

      <PageSection
        title="Report composition"
        description="Heading, context, filters and summary use spacing and dividers before another container."
      >
        <ReportHeader
          title="Sales register"
          description="Operational sales, payments and adjustments."
          period="Today, 12:00 AM – now"
          context={["All stations", "Restaurant"]}
        />
        <ReportFilters
          className="mt-4"
          title="Report filters"
          mobileContent={filters}
          variant="flat"
        >
          {filters}
        </ReportFilters>
        <ReportSummary
          className="mt-4"
          metrics={[
            {
              key: "sales",
              label: "Gross sales",
              value: "NPR 31,248",
              tone: "brand",
            },
            {
              key: "refunds",
              label: "Refunds",
              value: "NPR 1,569",
              tone: "danger",
            },
            {
              key: "net",
              label: "Net sales",
              value: "NPR 29,679",
              tone: "success",
            },
            { key: "count", label: "Transactions", value: "104", tone: "info" },
          ]}
        />
      </PageSection>

      <PageSection title="Feedback states">
        <div className="grid gap-3 lg:grid-cols-3">
          <LoadingState
            label="Loading transactions"
            className="rounded-2xl border border-border"
          />
          <EmptyState
            title="No returns found"
            description="Returns matching these filters will appear here."
          />
          <ErrorState
            title="Could not load sales"
            description="Check the connection and try again."
            actionLabel="Try again"
            onAction={() => undefined}
          />
        </div>
      </PageSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <PageSection
          title="Status, detail and surfaces"
          description="Semantic status is explicit; debit and credit are not color semantics."
          surface
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              tone="success"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Paid
            </StatusBadge>
            <StatusBadge tone="warning">Pending</StatusBadge>
            <StatusBadge tone="negative">Returned</StatusBadge>
            <StatusBadge tone="information">Posted</StatusBadge>
            <StatusBadge>Draft</StatusBadge>
          </div>
          <DetailGrid className="mt-5">
            <DetailField label="Customer" value="Walk-in customer" />
            <DetailField
              label="Business date"
              value={formatProductDate("2026-09-03")}
            />
            <DetailField
              label="Invoice"
              value={
                <Button variant="text" className="h-auto p-0">
                  SI-015210
                </Button>
              }
            />
          </DetailGrid>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            <Surface kind="section">
              <p className="text-sm font-medium">Standard section</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A calm container for related operational detail.
              </p>
            </Surface>
            <Surface kind="summary">
              <p className="text-xs font-medium text-muted-foreground">
                Status summary
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                4 pending
              </p>
            </Surface>
            <Surface kind="warning">
              <p className="text-sm font-medium">Needs review</p>
              <p className="mt-1 text-xs text-muted-foreground">
                One stock count is overdue.
              </p>
            </Surface>
            <Surface kind="interactive">
              <p className="text-sm font-medium">Open reconciliation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Interactive surfaces have one clear destination.
              </p>
            </Surface>
            <Surface kind="information">
              <p className="text-sm font-medium">Posting information</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Informational surfaces do not imply a financial state.
              </p>
            </Surface>
          </div>
        </PageSection>
        <PageSection
          title="Forms and overlays"
          description="Forms use labelled groups; complex mobile filters and forms use bounded sheets."
          surface
        >
          <FormSection
            title="New expense"
            description="Required fields are clear before validation."
          >
            <FieldGroup>
              <Label htmlFor="gallery-title">Description</Label>
              <Input id="gallery-title" placeholder="Enter a description" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="gallery-amount">Amount</Label>
              <Input
                id="gallery-amount"
                inputMode="decimal"
                aria-invalid="true"
                placeholder="NPR 0.00"
              />
              <p className="text-xs text-muted-foreground">
                Record the amount before tax.
              </p>
              <p className="text-xs font-medium text-destructive" role="alert">
                Enter a valid amount.
              </p>
            </FieldGroup>
          </FormSection>
          <FormActions className="mt-4">
            <Button variant="outline">Cancel</Button>
            <Button>Save expense</Button>
          </FormActions>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="mt-4">
                Open mobile filter sheet
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <p className="mt-4 text-sm text-muted-foreground">
                Sheets own scroll and provide one clear close path.
              </p>
            </SheetContent>
          </Sheet>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="mt-2 hidden md:inline-flex">
                Open desktop confirmation dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm stock adjustment</DialogTitle>
                <DialogDescription>
                  Desktop dialogs keep the decision and its actions together.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Confirm adjustment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageSection>
      </div>

      <PageSection
        title="Segmented control and tabs"
        description="Segments switch a small dataset mode; tabs switch separate page content."
        surface
      >
        <div className="space-y-4">
          <SegmentedControl
            value={segment}
            onValueChange={setSegment}
            ariaLabel="Inventory dataset"
            className="w-full max-w-sm lg:w-fit"
            items={[
              { value: "items", label: "Items" },
              { value: "activity", label: "Activity" },
            ]}
          />
          <PageTabs
            items={tabItems}
            value={tab}
            onValueChange={setTab}
            mobileMode="scroll"
            ariaLabel="Workspace views"
          />
        </div>
      </PageSection>

      <SummaryCard
        title="Adaptive action"
        description="Within pages, the action expands when context matters and compacts after scrolling."
      >
        <div className="relative h-28 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
          <AdaptiveFloatingAction
            placement="contained"
            mobileOnly={false}
            label="New order"
            icon={<Plus className="h-5 w-5" />}
            onClick={() => undefined}
          />
        </div>
      </SummaryCard>
    </AppPage>
  );
}
