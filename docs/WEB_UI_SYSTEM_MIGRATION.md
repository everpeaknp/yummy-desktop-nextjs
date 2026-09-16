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

| Concern            | Mobile                             | Tablet                          | Desktop                                |
| ------------------ | ---------------------------------- | ------------------------------- | -------------------------------------- |
| Page padding       | 16px                               | 24px                            | 32px, max content width by page family |
| Control height     | 44px minimum                       | 40px default / 44px touch-heavy | 40px default                           |
| Compact list row   | 56px minimum                       | 60px                            | 64px                                   |
| Surface radius     | 12px control, 16px grouped surface | same                            | 12px control, 16px surface             |
| Primary navigation | bottom navigation                  | touch-first bottom navigation   | sidebar from `lg`                      |
| Wide data          | card/list alternative              | bounded scroll region           | bounded scroll region                  |

Typography stays Inter and uses tabular numerals for money, quantities and
times. Routine operational labels use sentence case; letter spacing and
uppercase are reserved for genuine compact status labels, never decorative
eyebrows. Motion only explains a direct action and honours reduced motion.

No page may scroll horizontally. A data table may scroll only inside
`ResponsiveDataView`, with its own visible edge and mobile alternative.

## Responsive screen review contract

Mobile is a distinct product layout, not a stacked desktop page. A screen
family is only migrated when both forms have been intentionally designed and
reviewed.

| Form                  | Required design decisions                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile and tablet web | information hierarchy, app bar, route/back behavior, touch targets, list or card structure, action and filter placement, owned scrolling, bottom-nav visibility, and safe-area padding |
| Desktop web           | page width, toolbar, grid or table structure, information density, side-by-side composition, sidebar navigation, and bounded overflow behavior                                         |

Required review widths for every migrated family are 320px, 390px and 430px
for mobile; 768px for tablet; and 1024px and 1440px for desktop. A desktop-only
or mobile-only pass is not a migration.

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
  Its explicit `tableBreakpoint` decides when the bounded table replaces the
  mobile representation; the default is desktop (`lg`) so 768px stays
  touch-first unless a table is deliberately approved for tablet.
- `AdaptiveFloatingAction` owns the full-width-to-compact action transition.
  Pages supply its label, icon and route/action only.

Avoid a universal `Card` with many booleans. `MetricCard`, `OperationalCard`
and `SummaryCard` should have narrow semantic APIs because they communicate
different information density and priority.

## Migration approval states

| State                | Meaning                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| LEGACY               | No meaningful migration to the approved system.                                                          |
| PARTIAL              | Contains prior redesign work or shared patterns, but has not been reviewed against this approved system. |
| FOUNDATION-COMPLIANT | Uses the approved foundation end-to-end, but has not yet been accepted as a reference screen.            |
| APPROVED             | Visually and functionally reviewed as a canonical reference screen.                                      |
| COMPLETE             | The full screen family is migrated and its validation is complete.                                       |

Using a shared component, or receiving a prior redesign, does not promote a
page beyond PARTIAL. Existing work is retained as product evidence and reviewed
when its family enters a wave.

## Approved migration order

| Stage      | Scope                                                        | Approval outcome                                      |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Foundation | Phase 0/1 patterns, route presentation rules and UI gallery  | COMPLETE                                              |
| References | Manage, Inventory and Analytics                              | APPROVED reference-screen families                    |
| Wave 1     | Finance transaction and register family                      | APPROVED                                              |
| Wave 2/2B  | Finance reporting, control, Cash & Banks and Cash Drawers    | APPROVED                                              |
| Wave 3     | Orders, Order History, Order Detail and Quick Bill           | APPROVED                                              |
| Wave 4     | Kitchen / KOT operational family                             | APPROVED                                              |
| Wave 5     | Product configuration: menu, categories, modifiers, discounts and stations | NEXT                                      |
| Wave 6     | Tables, Reservations, receipt history and service operations | NEXT                                                  |
| Wave 7     | Supplier and Customer remaining party workflows              | NEXT                                                  |
| Wave 8     | Workforce / Staff                                            | NEXT                                                  |
| Wave 9     | Detailed Settings surfaces                                   | NEXT                                                  |
| Wave 10    | Dashboard, Profile and shell-level refinement                | NEXT                                                  |
| Wave 11    | Repository-wide QA, accessibility and deprecated-style cleanup | NEXT                                                |

Finance follows the reference wave rather than leading it, because its recent
domain-specific reporting and transaction-detail work must be preserved and
reviewed in context. The active finance route map and workflow rules remain in
[Finance mobile architecture](./FINANCE_MOBILE_ARCHITECTURE.md).

Wave 2/2B finance reporting and control are APPROVED. They retain three
controlled presentation archetypes: financial statements (Profit & Loss, Balance
Sheet, Cash Flow), accounting registers and reconciliations (Trial Balance,
Account Statement, Party Balances, Custody), and operational finance reports
(Daybook, refunds, VAT and department performance). Mobile and tablet retain
touch-first analytical rows below `lg`; desktop uses denser statements and
tables. These archetypes change presentation only and do not own accounting,
query, permission, export, source-document, business-date or timezone logic.
Source-document-first drill-down, neutral debit/credit presentation, the
corrected Balance Sheet equity hierarchy, informational abnormal-balance
warnings without automatic reclassification, and Cash Drawer operational versus
configuration separation are locked.

## Current approval status

| Family                                                            | Current state        | Evidence and next decision                                                                                                        |
| ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0/1 foundation and gallery                                  | COMPLETE             | Shared patterns, route-presentation metadata, responsive shell policy and visual gallery are ready for reference-screen review.   |
| Manage                                                            | APPROVED             | Approved management-directory reference family.                                                                                  |
| Inventory list, activity, detail and ledger                       | APPROVED             | Approved inventory family; preserve the distinct inventory-detail identity.                                                       |
| Analytics                                                         | APPROVED             | Approved analytics reference family.                                                                                              |
| Supplier and Customer remaining party workspaces                  | PARTIAL              | The broader party-workflow family remains for Wave 7; do not claim global approval.                                              |
| Finance transaction and register family                           | APPROVED             | Wave 1 register hierarchy and source-detail behavior are locked.                                                                 |
| Finance reporting and control                                     | APPROVED             | Wave 2/2B reporting, statement and control architecture is locked.                                                               |
| Cash & Banks / Cash Drawers                                       | APPROVED             | Operational custody and configuration separation is locked.                                                                      |
| Orders / Order History / Order Detail / Quick Bill                | APPROVED             | Wave 3 operational family is locked.                                                                                              |
| Kitchen / KOT                                                     | APPROVED             | Wave 4 canonical ticket family is locked.                                                                                         |
| Product configuration                                             | PARTIAL              | Wave 5 is next: menu, categories, options/modifiers, discounts where ownership fits, and stations/product configuration.        |
| Tables, Reservations, receipt history and service operations      | PARTIAL              | Wave 6.                                                                                                                            |
| Workforce / Staff                                                 | LEGACY               | Wave 8.                                                                                                                            |
| Detailed Settings                                                 | PARTIAL              | Wave 9.                                                                                                                            |
| Dashboard, Profile and shell-level refinement                     | PARTIAL              | Wave 10.                                                                                                                           |

## Remaining migration matrix

This is the authoritative sequencing register. It intentionally groups routes
that share one presentation owner; grouped entries must still retain their
own permissions and domain contracts.

| Screen / route                                                                                                                       | Family                                       | Current state        | Target archetype                               | Wave | Notes / preservation rules                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | -------------------- | ---------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/finance/sales`, `/finance/sales/returns`                                                                                           | Sales and credit-note registers              | APPROVED             | Register + shared transaction detail           | 1    | Preserve receipt, fiscal invoice, stable credit-note IDs and sale-return links.                                                                                                                          |
| `/finance/purchases`, `/finance/purchases/returns`                                                                                   | Purchase registers                           | APPROVED             | Register + shared transaction detail           | 1    | Preserve purchase-return source identity, allocation and settlement data.                                                                                                                                |
| `/finance/expenses`, `/finance/other-income`, `/finance/payments`, `/finance/transactions`, `/finance/journals`                      | Financial transaction registers              | APPROVED             | Register / workflow                            | 1    | Preserve payments, permissions, allocations, immutable journal reversal and source drill-down.                                                                                                           |
| `/finance/operations`                                                                                                                | Cash, banks, drawers and payment instruments | APPROVED             | Money-management workspace                     | 2B   | Compact balances, workspace tabs and operational/configuration registers; preserve all custody and drawer behavior.                                                                                      |
| `/finance`                                                                                                                           | Finance overview                             | APPROVED             | Finance workspace home                         | 2    | Current-period context, concise financial summary, attention items, and control entry points; not Analytics.                                                                                             |
| `/finance/reports`                                                                                                                   | Report catalog                               | APPROVED             | Grouped report navigation                      | 2    | One catalog grouped by business question; preserve every report deep link and permission guard.                                                                                                          |
| `/finance/reports/profit-and-loss`, `/finance/reports/balance-sheet`, `/finance/reports/trial-balance`, `/finance/reports/cash-flow` | Financial statements                         | APPROVED             | Accounting statement / analytical register     | 2    | Preserve statement calculations, recognized COGS, neutral accounting values, and account drill-down.                                                                                                     |
| `/finance/reports/account-ledger`, `/finance/reports/party-balances`, `/finance/reports/custody-reconciliation`                      | Ledger and reconciliation reports            | APPROVED             | Mobile analytical rows + bounded desktop table | 2    | Account Statement retains source-first document routing and backend-supplied running balances only.                                                                                                      |
| `/finance/reports/department-breakdown`, `/finance/reports/daybook`                                                                  | Operational control reports                  | APPROVED             | Responsive analytical report                   | 2    | Preserve backend aggregation, closed-period evidence, and existing drill-down behavior.                                                                                                                  |
| `/finance/reports/refunds`, `/finance/reports/vat-sales`                                                                             | Refund and tax registers                     | APPROVED             | Mobile register + bounded desktop table        | 2    | Shared report filters and currency/date presentation; export remains secondary.                                                                                                                          |
| `/finance/reports/sales-book`, `/finance/reports/invoices`, `/finance/reports/payments`                                              | Compatibility report entry points            | APPROVED             | Compatibility redirect                         | 1    | Continue redirecting to the approved Sales or Payments register; do not recreate duplicate reports.                                                                                                      |
| `/finance/reports/head-activity`                                                                                                     | Compatibility account report                 | APPROVED             | Compatibility redirect                         | 2    | Continue redirecting to the canonical Account Statement route.                                                                                                                                           |
| `/day-close`                                                                                                                         | Day Close control                            | APPROVED             | Sensitive reconciliation workflow              | 2    | Presentation only: preserve eligibility, totals, variance, close/reopen behavior, API calls, and confirmation.                                                                                           |
| `/finance/setup`                                                                                                                     | Finance configuration                        | APPROVED             | Grouped settings workspace                     | 2    | Taxes & fees links to its sole canonical owner; do not duplicate tax enablement or configuration.                                                                                                        |
| `/finance/accounting/*`                                                                                                              | Compatibility accounting routes              | APPROVED             | Compatibility redirect                         | 2    | The current layout redirects to `/finance/operations`; inaccessible legacy clients are not restyled or reactivated.                                                                                      |
| `/orders`, `/orders/history`, `/orders/[id]`, `/orders/[id]/receipt`, `/orders/new`                                                  | Sales operations                             | APPROVED             | Domain-specific operational workspace          | 3    | Keep approved Order cards, Order History cards, mobile New Order control/animation, Order Detail and Quick Bill unchanged unless a genuine defect is established.                                        |
| `/kitchen`                                                                                                                           | Kitchen operations                           | APPROVED             | Dedicated KOT ticket queue                     | 4    | Approved canonical ticket family; preserve variants, lifecycle, station/status filtering, queue ordering, printing, notifications and live refresh.                                                     |
| `/menu/*`, `/menu/categories`, `/menu/modifiers`, `/discounts`, `/manage/stations`                                                  | Product configuration                        | PARTIAL              | Catalog workspace + configuration forms        | 5    | NEXT: confirm domain ownership for discounts; preserve menu, pricing, inventory, fiscal, ordering and KOT contracts.                                                                                     |
| `/tables`, reservations and receipt history                                                                                          | Service operations                           | PARTIAL              | Domain-specific register / workflow            | 6    | Preserve table and booking context.                                                                                                                                                                      |
| Supplier/customer lists, statements, forms and embedded workflows                                                                    | Party workflows                              | PARTIAL              | Approved entity workspace                      | 7    | Reuse the approved workspace; do not redesign it.                                                                                                                                                        |
| `/staff/*`, attendance, leave, schedules and payroll                                                                                 | Workforce                                    | LEGACY               | Entity workspace / register / settings         | 8    | Avoid oversized hero-card treatment.                                                                                                                                                                     |
| Detailed `/settings/*` surfaces                                                                                                      | Settings                                     | PARTIAL              | Canonical settings                             | 9    | Preserve canonical `/settings` ownership and existing route compatibility.                                                                                                                               |
| Dashboard, Profile and shell-level surfaces                                                                                          | Global shell                                 | PARTIAL              | Shared navigation / page pattern               | 10   | Keep navigation ownership singular.                                                                                                                                                                      |
| Repository-wide responsive and accessibility cleanup                                                                                 | Cross-cutting                                | LEGACY               | Foundation cleanup                             | 11   | Only after the domain waves are manually accepted.                                                                                                                                                       |

## Acceptance criteria for every migrated route

- It uses `AppPage` and the appropriate shared header/control/data pattern.
- Both mobile/tablet and desktop satisfy the responsive screen review contract
  at 320px, 390px, 430px, 768px, 1024px and 1440px.
- Mobile has no page-level horizontal overflow; desktop tables and long-form
  workflows keep overflow within an owned bounded region.
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
- Do not start a reference-screen migration merely because its gallery pattern
  exists. Each family requires paired mobile and desktop review.

### Domain-specific pattern preservation

Shared primitives establish a common interaction grammar; they do not require
every domain workflow to use the same higher-level card or row pattern.

- **Orders:** Existing Order and Order History cards are approved
  product-specific patterns. Preserve their identity and workflow; future work
  must not visually redesign them without a genuine defect. Order Detail and
  Quick Bill are also approved Wave 3 patterns; do not replace them with
  generic `OperationalCard` or register rows merely for visual consistency.
- **Mobile New Order action:** The existing mobile New Order button and its
  animation are approved. Do not redesign, remove, reposition, simplify or
  change that animation unless a genuine accessibility or functional defect is
  established.
- **KOT / Kitchen:** The approved and locked KOT family uses dedicated board,
  compact Orders, embedded Order Detail and responsive detail variants rather
  than `OperationalCard`. Preserve ticket/order identity, elapsed time,
  quantity-plus-item hierarchy, modifiers/notes, station/status/readiness
  hierarchy, and clear Initial ticket / Additional items presentation. The
  20-minute delayed threshold remains business-owned.
- **Examples:** `OrderCard`, `OrderHistoryCard`, `KOTCard` and
  `FinancialStatementRow` are valid domain-specific higher-level patterns.

## Approved foundation governance

### Navigation and route presentation

- The restaurant mobile rail contains only permitted global destinations:
  Dashboard, Orders, Analytics when allowed, Profile, and Manage.
- Manage is the top-level mobile management hub. Finance, Inventory,
  Suppliers, Customers, Settings, Workforce, and their descendants are
  secondary modules: they use a back app bar and do not reserve bottom-nav
  space.
- Hotel PMS is outside this migration. Its navigation is not a restaurant
  mobile-shell reference.
- `lib/mobile-module-navigation.ts` is the incremental presentation boundary
  for mobile title, navigation level, and back fallback metadata. It must not
  become an API, permission, or business-workflow registry.
- The desktop sidebar begins at `lg`. Tablet widths keep the touch-first app
  bar and bottom navigation so a desktop rail never compresses the work area
  into horizontal overflow.

### Approved Settings information architecture

- `Manage` is the mobile and tablet management directory. At desktop widths,
  the persistent sidebar is the directory and direct `/manage` entry resolves
  to the first accessible workspace after client navigation data is ready.
- `/settings` is the canonical settings hub. The desktop sidebar links there;
  it must never expose a Manage item or a Settings parent rooted at `/manage`.
- Settings groups existing destinations by scope: Business, Finance & payments,
  People & access, Administration, Billing and Personal. It links to existing
  screens rather than duplicating configuration forms or permission logic.
- `/manage/profile` is business configuration and is labelled **Business
  profile**. It is not a personal profile. `/settings` reuses the implemented
  Additional Settings workspace as its canonical content, regrouped by scope.
  `/manage/additional-settings` remains a compatibility alias; `/manage/settings`
  is the dedicated Restaurant operations detail route rather than a second
  Settings root.
- Finance Setup (`/finance/setup`) remains the canonical finance owner. Taxes
  stay route-compatible at `/manage/taxes` and are discoverable from Finance &
  payments. Roles belong to People & access, audit logs and implemented data
  export to Administration, and `/premium` is the billing destination.
- Help remains a global support affordance, not a Manage or Settings row.
- Orders, Order History, the mobile New Order interaction, and KOT cards remain
  protected domain-specific patterns; this navigation work must not replace or
  redesign them.

### Product presentation standards

- Normal product UI formats money through `formatMoney` using the configured
  currency code (for Nepal, `NPR 1,234.00`). Fiscal and legal print layouts
  retain their explicitly required output.
- Use semantic statuses: success, warning, negative, information, neutral.
  Debit and credit remain accounting directions, not visual status colors.
- Keep Inter and the existing HSL theme tokens. Use 16px mobile page padding,
  24px tablet padding, 32px desktop shell padding, 44px touch controls, and
  56px interactive rows as the default responsive contract.
- Cards communicate a bounded task, summary, warning, or table. They are not
  a substitute for ordinary spacing or section grouping.
- Metric grids declare their density: financial metrics use one column below
  480px; short operational counts may use two columns from 360px. Both expand
  only when the available workspace can support their content.

### Route-family inventory

| Classification   | Representative routes                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Global top-level | `/dashboard`, `/orders`, `/analytics`, `/manage`, `/manage/profile`                                                                 |
| Secondary module | `/finance/*`, `/inventory/*`, `/suppliers/*`, `/customers/*`, `/staff/*`, `/menu/*`, `/tables`, `/reservations`, `/manage/settings` |
| Register         | Finance sales/purchases/transactions, inventory, suppliers, customers, staff, receipts                                              |
| Workspace/detail | Sale/return/purchase detail sheets, supplier and customer workspaces, inventory item sheet, staff detail                            |
| Report           | `/finance/reports/*`, Analytics, Day Close and accounting report clients                                                            |
| Workflow/form    | Checkout, new order, inventory consumption, payment/return dialogs, settings and designers                                          |

### Preserved Inventory-detail identity

The Inventory item detail sheet is an approved domain-specific pattern. Keep
its dark detail surface, warm orange stock/value emphasis, green Add action,
red Reduce action, neutral Count action, strong current-stock hierarchy,
separate Book value, compact Stock In/Stock Out summaries, linked menu and
modifier relationships, metadata, ledger access and clear low-stock status.
Future work may align spacing, type, touch targets, responsive behavior,
buttons, semantic status treatment, icons and app-bar/back behavior; it must
not flatten this sheet into a generic white detail page.

### Phase 1 acceptance boundary

- Extend `components/patterns` additively; do not globally restyle `Card` or
  migrate product pages until reference-screen approval.
- The UI gallery demonstrates app bars, action hierarchy, statuses, surfaces,
  rows, detail fields, metrics, filters, segments, tabs, forms, sheets, and
  feedback states.
- Preserve routes, permissions, API/query behavior, financial calculations,
  tax/fiscal output, inventory valuation, payroll, and all domain logic.
- Validate at 320, 390, 430, 768, 1024, and 1440 pixels with the gallery and
  the first approved reference screen wave.
- A responsive pattern is not approved merely because it avoids overflow.
  Mobile must have the correct composition: a desktop table is not a smaller
  mobile table, a desktop action row is not smaller buttons in one row, and a
  multi-column form is not a squeezed phone form. Tablet remains touch-first
  below `lg`, while using extra space for deliberate two-column detail or form
  compositions where values remain legible.

### Gallery approval package

The development gallery is the approval artifact for the foundation, not a
product screen migration. It is available only in development at
`/dev/ui-gallery`, where it runs outside the authenticated dashboard and
restaurant shell. Production requests return `notFound`. It demonstrates:

- top-level, secondary and detail app bars, including optional actions;
- primary, secondary, ghost, text, icon and destructive buttons;
- success, warning, negative, information and neutral statuses;
- standard, summary, interactive, warning and bounded-data surfaces;
- navigation, register, activity and entity list rows;
- `DetailField`, `DetailGrid` and linked detail values;
- compact metrics, financial summaries, status summaries and metric grids;
- search, filters, active filter counts, segments and genuine page tabs;
- grouped fields, help text, validation feedback and save/cancel footers;
- a mobile sheet, desktop dialog and detail-header action treatment; and
- loading, empty and error feedback.

The next approval screenshots focus on 390 × 844 mobile and 1440 × 900
desktop, while the remaining required widths are retained as regression review
views. Screenshots are review artifacts, not automated tests.
