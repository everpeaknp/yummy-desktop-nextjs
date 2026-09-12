# Web UI System Migration

## Purpose

Give Yummy's Next.js app one operational interaction grammar while retaining
the existing routes, API calls, state, and domain-specific workflows. This
migration targets the Next.js application only. Its new Yummy web design
system is the source of truth for both mobile and desktop web experiences.

The current Flutter application is outside the scope of this migration: no
Flutter code, components or screens will be changed, and its current UI is not
the reference implementation. Existing Next.js pages are product evidence,
not design specifications; every retained pattern must be reviewed against
the new web system first.

## Audit baseline

- 131 route pages; Finance accounts for 57, Manage 14, Orders 10, and Analytics 6.
- 35 primitive components exist in `components/ui`, but application patterns
  (search, filters, responsive tabs, report headers) do not.
- 62 files reference search and 40 reference tabs.
- `globals.css` contains 64 `dc-*` page-local classes. These should be
  migrated into named components, then removed; they must not become the
  standard for the rest of the product.

## Tokens and responsive contract

Use the existing HSL tokens in `app/globals.css` as the single source of
colour truth. Do not introduce per-page colour values.

| Concern | Mobile | Tablet | Desktop |
|---|---|---|---|
| Page padding | 16px | 24px | 32px, max content width by page family |
| Control height | 44px minimum | 40px default / 44px touch-heavy | 40px default |
| Compact list row | 56px minimum | 60px | 64px |
| Surface radius | 12px control, 16px grouped surface | same | 12px control, 16px surface |
| Primary navigation | bottom navigation | bottom nav or sidebar by workspace | sidebar |
| Wide data | card/list alternative | bounded scroll region | bounded scroll region |

Typography stays Inter and uses tabular numerals for money, quantities and
times. Routine operational labels use sentence case; letter spacing and
uppercase are reserved for genuine compact status labels, never decorative
eyebrows. Motion only explains a direct action and honours reduced motion.

No page may scroll horizontally. A data table may scroll only inside
`ResponsiveDataView`, with its own visible edge and mobile alternative.

## Component layers

`components/ui` remains the primitive layer. It should not absorb page policy.

```text
components/
  ui/                 # Button, Input, Card, Tabs, Dialog, Sheet
  app-shell/          # AppTopBar, BackButton, MobileBottomNav
  patterns/
    page/             # AppPage, PageHeader, PageSection, PageActions
    controls/         # SearchField, FilterBar, FilterChip, MobileFilterSheet
    navigation/       # PageTabs, ScrollableTabs, SegmentedTabs
    data/             # DataList, ListRow, ResponsiveDataView
    feedback/         # EmptyState, LoadingState, ErrorState
    actions/          # StickyActionBar, AdaptiveFloatingAction
  cards/              # MetricCard, OperationalCard, SummaryCard
  reports/            # ReportHeader, ReportFilters, ReportSummary
```

### Required boundaries

- `AppPage` owns width, mobile bottom padding, page spacing and overflow
  protection. It does not own business data.
- `PageHeader` owns title, description, back navigation and action placement.
- `SearchField` owns icon, clear action, 44px mobile hit target and loading
  state. It receives value and callbacks; it does not fetch.
- `FilterBar` renders desktop controls and passes the same filters to
  `MobileFilterSheet`; the page owns the filter state.
- `PageTabs` accepts an explicit `mobileMode`: `equal`, `scroll`, or `select`.
  A tab row must never silently overflow.
- `ResponsiveDataView` receives both table columns and a mobile row renderer.
  It is the only standard owner of a horizontal table scroller.
- `AdaptiveFloatingAction` owns the full-width-to-compact action transition.
  Pages supply its label, icon and route/action only.

Avoid a universal `Card` with many booleans. `MetricCard`, `OperationalCard`
and `SummaryCard` should have narrow semantic APIs because they communicate
different information density and priority.

## Reference pages

These are the canonical pages that prove the foundation before wider rollout:

1. Dashboard: app shell, metric and operational cards, compact mobile layout.
2. Orders: dense operational list/grid, tabs, search and
   `AdaptiveFloatingAction`.
3. Analytics: report filters, segmented tabs, metrics and bounded data views.
4. Finance Sales register: filters, register rows and desktop/mobile data
   alternatives.

The active finance route map, mobile hierarchy and workflow rules are defined
in [Finance mobile architecture](./FINANCE_MOBILE_ARCHITECTURE.md).

## Migration order

| Wave | Family | Risk | Outcome |
|---|---|---|---|
| 0 | Foundation + UI gallery | Low | tokens and patterns exist without route changes |
| 1 | Dashboard, Orders, Analytics, Finance Sales | Medium | reference implementations validate the system |
| 2 | KOT, Kitchen, Tables, Menu, Inventory | Medium | operations share search, tabs, lists and actions |
| 3 | Sales, Purchases, Returns, Expenses, Transactions | Medium | register pattern replaces ad hoc table layouts |
| 4 | Balance Sheet, Trial Balance, Ledgers, accounting reports | High | bounded financial tables with mobile summaries |
| 5 | Customers, Suppliers, Staff, Settings, Manage | Low-Medium | management lists and forms become consistent |
| 6 | Checkout, new order, finance forms, Hotel workflows | High | complex workflows migrate after primitives are proven |

## Current implementation status

- Wave 0 is complete: the shared page, control, navigation, data, feedback,
  card, report and adaptive-action patterns are implemented and covered by a
  development-only gallery and focused component tests.
- Wave 1 is in progress: Orders, Analytics, desktop Dashboard and Finance
  Sales now use the shared page language. The standalone mobile Dashboard
  composition still needs a component-level migration.
- Wave 2 is in progress: Kitchen, Tables, Menu and Inventory now use shared
  responsive page chrome, search, tabs, filters, metric cards and feedback
  states. Kitchen retains its specialist KDS ticket controls.
- Wave 3 is in progress: Sales, Sales Returns, Payments, Transactions and the
  management Purchases workspace use the shared page, metric, filter or
  operational-card patterns. Purchases has a compact mobile list and bounded
  desktop register.
- Wave 4 is in progress: the shared report shell and filter treatment now
  cover both accounting report families, including Trial Balance, Balance
  Sheet, Profit and Loss, ledgers, Cash Flow and VAT reports.
- Wave 5 is in progress: Customers and Suppliers use the shared headers,
  compact metrics, search fields, feedback states and responsive management
  list treatments.
- Remaining routes keep their current business behavior until their family is
  migrated; a changed outer shell alone does not count as completion.

## Acceptance criteria for every migrated route

- It uses `AppPage` and the appropriate shared header/control/data pattern.
- Mobile has no page-level horizontal overflow at 320px, 390px and 412px.
- Controls remain at least 44px when intended for touch.
- Wide data has a mobile representation and a bounded desktop table scroller.
- Loading, empty and error states use shared feedback components.
- Local page styling is deleted when a shared pattern replaces it.
- Existing API contracts, permissions and business behavior are unchanged.

## Implementation guardrails

- Migrate a page family only after its target pattern is built and reviewed in
  the gallery.
- Do not alter data fetching or domain state during a visual migration.
- Implement mobile and desktop workflows from this Next.js design system.
- Do not modify Flutter code or treat Flutter screens as visual authority.
- Prefer extending an existing pattern with a named variant over adding page
  specific CSS.
