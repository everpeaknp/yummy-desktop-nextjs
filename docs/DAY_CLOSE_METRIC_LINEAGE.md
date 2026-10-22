# Day Close Metric Lineage

**Status:** Day Close 2.6A — CANONICAL METRICS COMPLETE  
**Scope:** canonical exact-period financial metrics and cross-system parity  
**Not included:** Day Close 3, new UI, accounting changes, new rankings, or historical data mutation

## 1. Executive determination

Day Close already stores a substantial operational record: finance totals, orders,
payments, refunds, expenses, manual income, drawer evidence, receivables, category,
item and table summaries, purchases, and validation evidence. It is not yet a safe
single source for every proposed insight.

The contract must therefore be:

1. Finance/reporting owns financial meanings and totals.
2. Shared backend aggregations own operational rankings.
3. Day Close stores the exact values, rows, identities, warnings, and contract
   versions used at confirmation.
4. React formats authoritative results; it does not reconstruct financial totals.
5. Missing evidence is `unavailable`, never an inferred zero or an empty success.
6. The confirmed report reads its frozen snapshot. It does not silently recompute
   history from today's Finance or Analytics behavior.

The current snapshot is transitional. When the reporting ledger is incomplete,
some payment, refund, expense, and custody evidence can use legacy operational
sources. `financial_summary.source`, `ledger_source`, `ledger_complete`, warnings,
and section availability must remain visible to the report contract.

## 2. Period and authority contract

### Exact covered period

All period metrics use the Day Close interval:

```text
[period_start_at, period_end_at)
```

The start is the previous confirmed close boundary for the same restaurant and
business-line scope, or the configured inception boundary. The end is the final
server-captured confirmation boundary. Records exactly at the end belong to the
next close.

Every shared query must receive the exact timestamps and business-line scope. A
calendar-date query is not equivalent for late or multi-day closes.

### Authority by metric family

| Metric family                                                           | Canonical authority                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sales, discounts, collections, credit, refunds, manual income, expenses | Finance reporting/event aggregation for the exact period                                    |
| Tax and service charge                                                  | Finance recognized-sale event metadata; explicit order fallback only for incomplete ledgers |
| Outstanding customer receivables                                        | Party ledger balance as of `period_end_at`                                                  |
| Drawer expected/count/variance                                          | Drawer sessions and approved drawer evidence                                                |
| Orders, items, categories, tables, channels                             | Shared operational order aggregation                                                        |
| Purchases, purchase payments, supplier balances and returns             | Shared purchasing/party-ledger aggregation; current Day Close totals are not sufficient     |
| Staff attribution                                                       | Explicit operational actor roles; never a generic staff score                               |
| Hotel daybook                                                           | Hotel domain snapshot and its own source identities                                         |

### Current source map

| Evidence                    | Current backend service/table path                                                                                                                   | Timestamp and filtering                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Canonical finance summary   | `DayCloseService._finance_core_day_close_snapshot` -> `AnalyticsService.get_finance_summary` -> `FinanceReportingService` / finance reporting events | Exact `start_time`/`end_time`, UTC, restaurant, business line, cache bypassed; event status rules are owned by Finance       |
| Orders and order items      | `DayCloseService.generate_snapshot` -> `Order`, `OrderItem`, order item snapshots                                                                    | Terminal order timestamp in `[start, end)`; completed/cancelled terminal statuses; restaurant and normalized business line   |
| Collections and instruments | Finance `collection_received` events; transitional `OrderPayment` fallback                                                                           | Exact event/payment timestamp; successful positive payments; restaurant/business line inherited from source                  |
| Refund evidence             | Finance `refund_processed` total plus successful negative `OrderPayment` rows                                                                        | Refund payment `created_at` in `[start, end)`; restaurant and included order scope                                           |
| Expenses                    | Finance expense-like events plus uncovered legacy `Expense` records                                                                                  | Finance event time or legacy `Expense.created_at` in `[start, end)`; restaurant/business line; discrepancy expenses excluded |
| Manual income               | Finance total plus `IncomeEntry` rows where `source=manual`                                                                                          | Confirmed entries with `paid_at` in `[start, end)`; restaurant/business line                                                 |
| Credit and receivables      | Finance credit events plus `PartyLedgerService.receivables_snapshot`                                                                                 | Credit movements in `[start, end)`; outstanding receivable measured as of `end`                                              |
| Drawer evidence             | Drawer-control/session services and approved drawer count/variance evidence                                                                          | Sessions overlapping `[start, end)`; configured restaurant drawers; count/approval state retained                            |
| Paid purchases              | `GeneralPurchase`                                                                                                                                    | Received + paid; current query uses `updated_at` in `[start, end)`                                                           |
| Pending purchases           | `GeneralPurchase`                                                                                                                                    | Received + pending with `created_at <= end`; deliberately not a period-only population                                       |
| Hotel evidence              | Hotel close/daybook services                                                                                                                         | Exact close period and Hotel/Combined business-line scope                                                                    |

Where a current implementation mixes Finance events with legacy rows, the
section must preserve `source`, `ledger_source`, `ledger_complete`, and warning
metadata. The UI must not conceal a transitional fallback by presenting it as a
single fully migrated source.

## 3. Current snapshot inventory

The table below describes the current single-business-line snapshot. Combined
Hotel + Restaurant closes use `day-close.combined.v1`, retain a per-business-line
summary and shared drawer evidence, and must not be treated as structurally
identical to a Restaurant snapshot.

| Field/group                             | Meaning and current source                                                             | Time/status/scope rules                                             | Period or balance                                         | IDs retained                                              | Contract finding                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `period_start_at`, `period_end_at`      | Exact close boundary from Day Close service                                            | UTC half-open interval; restaurant and business line                | Identity                                                  | Close ID separately                                       | READY                                                                                        |
| `financial_summary`                     | Analytics finance summary backed by Finance reporting; contract `day-close.finance.v2` | Exact timestamps, UTC, business line; cache bypassed                | Period except explicitly named balance fields             | No row IDs                                                | Canonical financial summary                                                                  |
| `gross_sales`                           | Finance gross sales (`sales_total + discount_total`) with compatibility mirrors        | Exact period; canonical event status rules                          | Period movement                                           | No                                                        | READY                                                                                        |
| `sales_total`                           | Recognized sales before refunds                                                        | Exact period; posted/recognized events                              | Period movement                                           | No                                                        | READY                                                                                        |
| `discount_total`                        | Finance discount events                                                                | Exact period                                                        | Period movement                                           | No                                                        | READY                                                                                        |
| `net_sales`                             | Canonical sales less refunds                                                           | Exact period                                                        | Period movement                                           | No                                                        | READY; do not recalculate in React                                                           |
| `tax_total`                             | Completed order tax total                                                              | Included completed orders                                           | Period movement                                           | No                                                        | NEEDS SNAPSHOT EXTENSION: stored on close record but not self-contained in detailed snapshot |
| `service_charge_total`                  | Completed order service-charge total                                                   | Included completed orders                                           | Period movement                                           | No                                                        | NEEDS SNAPSHOT EXTENSION                                                                     |
| `collections_total`                     | Successful collections, canonical finance events when complete                         | Exact period; positive successful collections                       | Period movement                                           | Payment source identity is incomplete                     | READY total; rows need extension                                                             |
| `payment_distribution`                  | Collection/payment method breakdown                                                    | Exact period; compatibility fallback possible                       | Period movement                                           | No payment IDs in all paths                               | READY with provenance                                                                        |
| `payment_instrument_distribution`       | Card/digital/PhonePe instrument names and values                                       | Same as collections                                                 | Period movement                                           | Instrument name, not stable instrument ID                 | NEEDS SNAPSHOT EXTENSION for drill-down                                                      |
| `cash_*` / `drawer_control`             | Drawer sessions, opening, expected, count, variance and approvals                      | Sessions overlapping exact period; drawer policy controls authority | Opening/count are boundary evidence; movements are period | Drawer/session/configuration/cashier IDs                  | READY                                                                                        |
| `refunds`                               | Successful negative order payments                                                     | Refund payment `created_at` in exact period                         | Period movement                                           | Order IDs retained; credit-note/source-document ID absent | READY aggregate; source identity extension required                                          |
| `expense_*`                             | Legacy Expense rows plus uncovered finance expense events                              | Exact period and business line; discrepancy expenses excluded       | Period movement                                           | Expense IDs; finance events encoded as negative IDs       | NEEDS SNAPSHOT EXTENSION for typed identity                                                  |
| `manual_income_*`                       | Confirmed manual `IncomeEntry` rows                                                    | `paid_at` in exact period, business line                            | Period movement                                           | Income entry ID                                           | READY                                                                                        |
| `credit_settlement`                     | Credit sales and successful credit collections                                         | Exact period                                                        | Period movement                                           | Order IDs; customer names only                            | READY totals; customer drill-down unavailable                                                |
| `receivables`                           | Party-ledger credit/cash collections plus outstanding receivables                      | Collections use exact period; outstanding is measured at close      | Mixed: movement and balance                               | Customer IDs not consistently frozen                      | READY if labels preserve distinction                                                         |
| `paid_purchase_*`                       | Received and paid General Purchases                                                    | Current implementation uses purchase `updated_at` in period         | Period movement-like, but not canonical transaction date  | No purchase or supplier rows                              | NEEDS SHARED AGGREGATION and SNAPSHOT EXTENSION                                              |
| `pending_purchase_*`                    | Received pending purchases known by close                                              | `created_at <= period_end_at`; no period-start filter               | Point-in-time/open set                                    | No purchase/supplier IDs                                  | Must not be labeled purchases during period                                                  |
| `orders`                                | Completed order evidence with values and payments                                      | Included completed orders; cancelled orders excluded from rows      | Period movement/register                                  | Order and restaurant-order IDs, table ID; no customer ID  | READY for completed-order register only                                                      |
| `operational_snapshot`                  | Completed/cancelled counts, average order value/items, channel breakdown               | Included terminal orders in exact period                            | Period activity                                           | No source rows for cancelled orders                       | Summary READY; full register needs extension                                                 |
| `sales_by_channel`                      | Completed-order billed value by channel                                                | Exact period, completed orders                                      | Period movement                                           | No order IDs in aggregate                                 | READY with explicit gross/net semantics                                                      |
| `sales_by_category`, `category_details` | Order-item quantity and line value grouped by category name                            | Completed orders                                                    | Period movement                                           | No category/menu-item IDs                                 | NEEDS SHARED AGGREGATION and IDs                                                             |
| `menu_performance`, `top_items`         | Item quantity, revenue and order count grouped by item name                            | Completed orders; `top_items` currently ranks revenue               | Period movement                                           | No menu-item IDs                                          | Current evidence exists; canonical rankings need shared aggregation                          |
| `sales_by_table`, `table_details`       | Completed-order billed value grouped by table                                          | Completed orders                                                    | Period movement                                           | Table IDs and nested order IDs                            | READY if described as completed-order billed value                                           |
| `hourly_sales`                          | Completed-order sales grouped by completion hour                                       | Current bucket uses stored UTC hour                                 | Period movement                                           | No                                                        | NEEDS SHARED AGGREGATION with restaurant-local hour                                          |
| `customer_name` on orders               | Display-only customer label                                                            | Completed orders                                                    | Attribution                                               | No customer ID                                            | NOT RELIABLY ATTRIBUTABLE for customer rankings                                              |
| staff/users                             | No reliable sales/server/cashier attribution section                                   | N/A                                                                 | Attribution                                               | No staff IDs                                              | NOT RELIABLY ATTRIBUTABLE                                                                    |
| `hotel_revenue_split`, `hotel_daybook`  | Hotel-specific revenue and operational evidence                                        | Exact Hotel/Combined scope                                          | Mixed according to Hotel contract                         | Hotel domain IDs where supplied                           | READY only within Hotel contract                                                             |
| `validation_checks`, accounting bridge  | Readiness, finance review, drawer and accounting evidence                              | Exact close scope                                                   | Audit evidence                                            | Diagnostic/source IDs vary                                | READY; preserve plain-language and technical layers                                          |

## 4. Cross-system metric lineage

Matching labels do not guarantee matching populations or timestamps.

| Metric                            | Canonical owner/source                            | Day Close today                                           | Finance today                                                 | Analytics today                                       | Difference/risk                                                | Required contract                                    |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Gross sales                       | Finance reporting events                          | Uses Analytics finance summary and mirrors result         | `sales_total + discounts`                                     | Finance-backed summary with transition merge          | Operational order gross also exists                            | Persist canonical value, source and contract version |
| Net sales                         | Finance reporting events                          | Canonical summary                                         | Sales recognized less refunds                                 | Same finance path                                     | Order `grand_total` sum can differ during incomplete migration | Day Close = Finance for exact period                 |
| Collections                       | Finance collection events                         | Canonical when ledger complete; legacy fallback otherwise | Collection received events                                    | Finance-backed plus compatibility path                | Source may change by migration state                           | Store provenance and completeness                    |
| Refunds                           | Finance refund events                             | Finance total plus detailed negative-payment evidence     | Refund processed events                                       | Finance-backed summary                                | Detail rows lack credit-note identity                          | Freeze typed source-document identity                |
| Expenses                          | Finance expense events                            | Finance total; detail merges legacy/uncovered events      | Expense-like reporting events                                 | Some analytics endpoints still query legacy Expense   | Deduplication and source identity are transitional             | Shared expense evidence query                        |
| Manual income                     | Finance + IncomeEntry source bridge               | Finance total and manual rows                             | Manual-income events                                          | Finance-backed summary                                | Rows are only manual IncomeEntry evidence                      | Freeze event/source IDs                              |
| Credit sales                      | Finance credit-sale events                        | Finance total; order evidence                             | Credit sale created events                                    | Finance-backed summary                                | Customer identity is absent in snapshot                        | Add customer/source IDs                              |
| Credit collections                | Party ledger / finance settlement contract        | Period collections in receivables/credit settlement       | Credit repayment events                                       | Finance-backed and party-ledger data                  | Must not be confused with total receivables                    | Separate movement field                              |
| Outstanding receivables           | Party ledger                                      | Balance as of close                                       | Reporting exposes receivable metrics, commonly period-derived | Party-ledger snapshots available                      | Same label can mean movement or balance                        | Name `outstanding_receivables_at_close`              |
| Tax/service charge                | Order/fiscal reporting                            | Close-record totals; not complete detailed JSON           | Not part of current finance summary contract                  | Operational order queries                             | Frozen report can lose self-contained values                   | Extend evidence snapshot                             |
| Payment methods/instruments       | Finance collections + payment instrument registry | Breakdown with fallback                                   | Payment breakdown from collection events                      | Finance summary/breakdowns                            | Stable instrument IDs not frozen                               | Shared typed breakdown rows                          |
| Orders/AOV                        | Operational orders                                | Direct Day Close query                                    | Not a ledger metric                                           | Analytics order aggregations                          | Day Close duplicates operational formulas                      | Extract shared exact-period aggregation              |
| Item/category/table/channel sales | Operational order items                           | Direct snapshot aggregation                               | Not finance row-level dimensions                              | Analytics has overlapping aggregations                | Refund allocation, IDs and timezone can differ                 | One shared operational aggregation contract          |
| Purchases                         | Purchasing domain                                 | Mixed paid-period and pending-at-close totals             | Supplier/purchase events exist for accounting                 | Some endpoints use legacy purchase queries            | Semantics and date field are inconsistent                      | Shared purchasing period/balance query               |
| Staff metrics                     | Explicit actor roles                              | Missing                                                   | Not a reporting total                                         | Creator/completer/item-adder metrics exist separately | No single `top staff` meaning                                  | Separate server, creator and cashier contracts       |

## 5. Period movement versus point-in-time balance

### Period movement

- gross sales, recognized sales, discounts, net sales;
- tax and service charge generated in the period;
- payments collected and payment-method/instrument breakdown;
- refunds processed;
- expenses and manual income recorded under their canonical transaction dates;
- credit sales and credit collections;
- completed/cancelled orders and operational item/category/table/channel values;
- drawer cash movements; and
- canonical purchases, supplier payments, and returns once the shared purchase
  contract exists.

### Point-in-time or boundary evidence

- opening drawer balance;
- counted drawer cash and custody balance;
- outstanding customer receivables at close;
- pending/open purchases at close;
- supplier payable balance at close; and
- open orders, unresolved drawer sessions, or accounting blockers at validation.

The product must use labels such as `during this close` and `at close`. It must
never place an outstanding balance beside period movement without explaining the
difference.

## 6. Insight readiness

`READY` means the current backend can supply a defined value. It does not always
mean that a complete source-document drill-down is available.

| Requested insight                | Classification                                                | Reason / required next work                                                                       |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Most sold items                  | NEEDS SHARED AGGREGATION                                      | Quantity exists, but there is no canonical net-of-returns ranking or item ID contract             |
| Highest-sales items              | NEEDS SHARED AGGREGATION                                      | Current revenue ranking is name-based and direct Day Close logic duplicates Analytics             |
| Top categories                   | NEEDS SHARED AGGREGATION + NEEDS SNAPSHOT EXTENSION           | Values exist, but category IDs and refund semantics do not                                        |
| Top tables                       | READY                                                         | Table/order IDs exist; label as completed-order billed value until refund allocation is canonical |
| Sales by channel/order type      | READY                                                         | Exact completed-order aggregation; name the amount semantics explicitly                           |
| Hourly sales                     | NEEDS SHARED AGGREGATION                                      | Current UTC hour is not a safe restaurant-local business-hour view                                |
| Average order value              | READY                                                         | Completed-order total divided by completed-order count; source population must be shown           |
| Top customers                    | NOT RELIABLY ATTRIBUTABLE                                     | Snapshot has names but not stable customer IDs; walk-ins cannot be ranked as people               |
| Top staff/server                 | NOT RELIABLY ATTRIBUTABLE                                     | No staff IDs or authoritative server role frozen                                                  |
| Top cashier                      | NOT RELIABLY ATTRIBUTABLE                                     | Payment collector identity is not consistently retained                                           |
| Top suppliers                    | NEEDS SHARED AGGREGATION + NEEDS SNAPSHOT EXTENSION           | Current purchase totals contain no supplier identity                                              |
| Purchases during period          | NEEDS SHARED AGGREGATION + NEEDS SNAPSHOT EXTENSION           | Current paid/pending fields use mixed date and balance semantics                                  |
| Purchase returns                 | NEEDS SNAPSHOT EXTENSION                                      | No distinct frozen purchase-return evidence                                                       |
| Sales returns/refunds            | READY aggregate; NEEDS SNAPSHOT EXTENSION for full drill-down | Refund total and order IDs exist; credit-note/return IDs do not                                   |
| Receivables at close             | READY                                                         | Party-ledger balance as of the exact end; must be labeled a balance                               |
| Credit collections during period | READY                                                         | Party-ledger/finance movement; keep separate from outstanding balance                             |

## 7. Canonical ranking definitions

No user-facing label may say only `Top`.

### Most sold items

- **Population:** completed order items in the exact close period.
- **Measure:** net item quantity after item-level returns when the return allocation
  contract exists.
- **Exclusions:** cancelled/voided quantities; complimentary quantities must be
  reported separately if included as served units.
- **Ties:** net sales descending, then stable item ID.
- **Minimum evidence:** menu item ID, gross quantity, returned quantity, net
  quantity, order count and source order IDs.

### Highest-sales items/categories/tables

- **Measure:** canonical net attributed sales, in the restaurant's configured
  currency, after attributable discounts and returns.
- **Ties:** net quantity/order count descending, then stable entity ID.
- **Minimum evidence:** stable entity ID and source-order identities.
- Until return allocation exists, Table ranking must be labeled
  `Completed-order billed value`, not `net sales`.

### Highest-sales customers

- Only orders linked to a stable `customer_id` are eligible.
- Walk-in or unidentified orders remain an unassigned summary group, never a
  person.
- Rank by canonical customer-linked net sales; expose order count and credit
  balance separately.

### Sales/orders by staff and payments by cashier

- `Sales by server`, `Orders created by`, and `Payments handled by cashier` are
  separate views.
- Each requires the corresponding stable user/staff ID on the source record.
- No combined performance score is permitted.

### Highest purchases by supplier

- **Population:** accepted/received purchases attributed to `supplier_id` in the
  exact period.
- **Measure:** canonical purchase amount net of purchase returns.
- Supplier payments and supplier balance are separate measures.

## 8. Source identity and drill-down contract

Every evidence row must carry a typed destination, not a display-string guess:

```ts
type DayCloseSourceTarget =
  | { kind: "order"; id: number }
  | { kind: "sales-return"; id: number; orderId?: number }
  | { kind: "payment"; id: number; orderId?: number }
  | { kind: "expense"; id: number }
  | { kind: "finance-event"; id: number }
  | { kind: "purchase"; id: number }
  | { kind: "purchase-return"; id: number; purchaseId?: number }
  | { kind: "customer"; id: number }
  | { kind: "staff"; id: number }
  | { kind: "supplier"; id: number }
  | { kind: "drawer-session"; id: number };
```

The web client should use one central resolver shared with existing transaction
detail routing. Known source-document fetch failure must show an error for that
source; it must not silently open a generic event detail. Current negative
finance-event IDs in expense rows must be replaced by typed IDs before direct
drill-down.

## 9. `DayCloseEvidence` contract

One evidence model should support the live Review, final Review Close,
Completion/View report, historical detail, email, and export layers:

```ts
type EvidenceAvailability =
  | { state: "available"; source: string; contractVersion: string }
  | { state: "partial"; source: string; warnings: string[] }
  | { state: "unavailable"; reason: string };

type DayCloseEvidenceSection<TSummary, TInsight, TRow> = {
  availability: EvidenceAvailability;
  summary: TSummary | null;
  insights: TInsight[];
  breakdowns: unknown[];
  sourceRows: TRow[];
  warnings: string[];
};

type DayCloseEvidence = {
  identity: unknown;
  overview: DayCloseEvidenceSection<unknown, never, never>;
  moneyMovement: DayCloseEvidenceSection<unknown, unknown, unknown>;
  sales: DayCloseEvidenceSection<unknown, unknown, unknown>;
  customers: DayCloseEvidenceSection<unknown, unknown, unknown>;
  staff: DayCloseEvidenceSection<unknown, unknown, unknown>;
  cash: DayCloseEvidenceSection<unknown, unknown, unknown>;
  outgoings: DayCloseEvidenceSection<unknown, unknown, unknown>;
  purchases: DayCloseEvidenceSection<unknown, unknown, unknown>;
  suppliers: DayCloseEvidenceSection<unknown, unknown, unknown>;
  credit: DayCloseEvidenceSection<unknown, unknown, unknown>;
  orders: DayCloseEvidenceSection<unknown, unknown, unknown>;
  accountingAudit: DayCloseEvidenceSection<unknown, unknown, unknown>;
};
```

The illustrative `unknown` payloads above are contract slots, not permission to
use untyped frontend data. Backend schemas must define each section before it is
implemented. Availability is mandatory so clients cannot turn missing sections
into `0` or an empty success.

### Information depth

1. **Decision summary:** can the day close, principal totals, cash result, and
   actionable warnings.
2. **Domain summaries:** money, sales, customers, staff, cash, outgoings,
   purchases/suppliers, credit and accounting evidence.
3. **Source registers:** authoritative transactions opening their existing detail
   UI.

Mobile uses progressive disclosure. Desktop may use sticky local section
navigation. The former large tab wall must not be restored unchanged.

## 10. Live and frozen behavior

### Live

- Generated from authoritative Finance, drawer, party-ledger, purchasing and
  operational sources for the current exact interval.
- Clearly labeled `Live` and refreshable.
- May change until confirmation.
- Never mixed with a previously confirmed snapshot.

### Frozen

- Confirmation regenerates evidence at the final server boundary and stores it
  with the close.
- Historical UI, email and exports read that stored evidence.
- Normal Finance/Analytics recomputation must not alter a confirmed report.
- Explicit corrections/reopen/resync may replace or version evidence only through
  an audited workflow; generated-at time, reason, actor and superseded version
  must remain traceable.

### Fields that must be frozen at confirmation

- close identity, restaurant, business line, timezone and exact interval;
- currency, metric contract versions, sources, completeness and warnings;
- every displayed financial total, including tax and service charge;
- payment methods/instruments and source payment identities;
- drawer sessions, movements, counts, variances and approvals;
- order and order-item source rows required by displayed aggregates;
- refund, expense, manual-income, purchase and purchase-return identities;
- customer, staff, supplier, category, item and table IDs used by insights;
- period credit movements and point-in-time receivable/supplier balances;
- ranking population, measure and tie metadata; and
- readiness/accounting audit evidence and report-delivery status.

## 11. Email contract

The automatic email is a concise management summary, not the raw evidence dump.
It contains:

- close identity, business date, scope and exact covered period;
- sales, collections, refunds, expenses and verified purchase movement;
- credit sales/collections and receivables-at-close with distinct labels;
- expected cash, counted cash and difference;
- completed/cancelled order counts;
- only verified operational insights;
- important warnings and correction/reopen status; and
- a link to the saved report.

Email delivery failure remains separate from close success. Retry/status may be
shown only when backed by current delivery evidence. The current implementation
attaches a large PDF; Day Close 2.6 should replace automatic raw-register delivery
with the concise contract while retaining an explicit detailed PDF export.

## 12. Device export contract

Detailed exports are user-requested and generated from the frozen snapshot.

Preferred Excel sheets, enabled only when verified data exists:

1. Summary
2. Orders
3. Order Items
4. Payments
5. Refunds
6. Expenses
7. Purchases
8. Suppliers
9. Customers
10. Credit & Receivables
11. Cash Drawers
12. Cash Movements
13. Sales by Item
14. Sales by Category
15. Sales by Table
16. Sales by Staff
17. Audit

Every workbook includes the exact period, timezone, business line, currency,
close ID, generated timestamp and contract version. Omitted sheets are listed in
a manifest with their availability reason. A detailed PDF is a separate explicit
export, not an automatic substitute for the concise email.

The current Excel export is incomplete: it has Summary, Operational, Orders,
Category Detail, Menu Performance, Payment Instruments, Credit Orders, and Table
Detail. It must not be described as the full evidence workbook.

## 13. Consistency test matrix

For one restaurant, business line and exact `[start, end)` interval:

| Assertion                                                         | Required result            |
| ----------------------------------------------------------------- | -------------------------- |
| Day Close net sales vs Finance net sales                          | Equal                      |
| Day Close collections vs Finance/payment reporting                | Equal                      |
| Day Close refunds vs Finance refund reporting                     | Equal                      |
| Day Close expenses vs Finance expense reporting                   | Equal                      |
| Day Close credit sales/collections vs canonical reporting         | Equal                      |
| Day Close operational sales vs shared Analytics aggregation       | Equal when semantics match |
| Live report confirmed at the same end boundary vs frozen snapshot | Equal                      |
| Historical report before/after later reporting-code change        | Frozen values unchanged    |

Differences are allowed only under a named semantic contract. Tests must cover:

- discounts, tax and service charge;
- full and partial refunds, credit notes and returned items;
- cash, card/QR, split payments and credit;
- cancelled/voided orders;
- manual income and expenses;
- purchases, supplier payments and purchase returns;
- multiple drawers and variance approval;
- known/walk-in customers;
- multiple staff roles;
- late and multi-day closes; and
- Restaurant, Hotel and Combined scopes.

## 14. Known gaps that block speculative UI

- Tax and service-charge values are not self-contained in the detailed snapshot.
- Current order rows omit cancelled-order source evidence.
- Customer, staff, supplier, category and menu-item stable IDs are missing from
  several summaries.
- Current purchase fields mix period movement with an outstanding/open set.
- Purchase returns are not frozen distinctly.
- Refund rows do not consistently identify the credit note/return source.
- Expense finance-event identity is encoded implicitly instead of being typed.
- Hourly sales is not safely localized to the restaurant timezone.
- Current frontend snapshot helpers can convert unavailable amounts to zero.
- The live flow and historical snapshot use separate presentation structures.
- Email/PDF/Excel do not yet share one evidence contract.

## 15. Day Close 2.6 implementation stages

### A. Canonical/shared metric fixes

- Extract exact-period operational aggregations shared with Analytics.
- Align purchase, return, tax/service-charge and timezone semantics.
- Add the consistency fixtures before displaying new insights.

### B. Snapshot/evidence extensions

- Introduce versioned `DayCloseEvidence` backend schemas.
- Freeze missing values, stable IDs, availability and warnings.
- Keep explicit compatibility adapters for older snapshots; never invent zeros.

### C. `DayCloseEvidenceView`

- One information architecture for live, confirmation, completion and history.
- Preserve the short Review → Cash → Close path.
- Add progressively disclosed Level 2 summaries and Level 3 registers.

### D. Transaction drill-down

- Add a centralized typed source resolver.
- Open existing order, return, expense, purchase, customer, staff, supplier and
  drawer detail surfaces.

### E. Email summary

- Generate a concise close email from frozen evidence.
- Preserve delivery failure/retry independently of close success.

### F. Detailed device exports

- Generate versioned Excel sheets and an optional detailed PDF from frozen
  evidence.
- Include a sheet/section availability manifest.

Day Close 3 must not begin until Day Close 2.6 has canonical metric tests,
versioned snapshot evidence, and explicit manual QA approval.

## 16. Day Close 2.6A final canonical status

`CanonicalReportingService` now owns the typed financial response consumed by
Finance, Analytics finance summary, and the live Day Close snapshot builder. It
accepts only a restaurant, optional business-line scope, and an exact UTC
half-open `[period_start_at, period_end_at)` interval. Date-based consumers must
resolve dates before calling it.

Recognized Finance events own gross sales, discounts, tax, service charge, net
sales, collections, payment methods/instruments, refunds, manual income,
expenses, credit movement, and expected cash. Tax and service charge come from
immutable recognized-sale metadata. Payment totals and their groupings are
derived from the same collection-event population. Split payments remain
separate collection events; credit sales are not collections; cancelled orders
do not become recognized sales; refunds remain distinct from supplier returns.

When the ledger is explicitly incomplete, the existing operational source is
used once, with `source=operational_fallback`,
`ledger_source=legacy_plus_finance_events`, and a warning. The fallback does not
add order totals to equivalent Finance totals. Future confirmed snapshots store
the resulting values and provenance under `day-close.finance.v3`; existing
confirmed snapshots remain untouched.

| Metric                   | Final state                      | Canonical owner / reason                                                                                              |
| ------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sales                    | CANONICAL WITH EXPLICIT FALLBACK | Finance recognized-sale and discount events; legacy completed-order compatibility only while ledger incomplete        |
| Payments                 | CANONICAL WITH EXPLICIT FALLBACK | Finance collection events, including method/instrument grouping; legacy successful positive payments during rollout   |
| Refunds                  | CANONICAL WITH EXPLICIT FALLBACK | Finance sales-refund events; legacy negative successful order payments during rollout                                 |
| Expenses                 | CANONICAL WITH EXPLICIT FALLBACK | Finance expense events; existing uncovered Expense compatibility path while ledger incomplete                         |
| Credit sales             | CANONICAL WITH EXPLICIT FALLBACK | Finance credit-sale events; legacy credit payment allocation during rollout                                           |
| Credit collections       | CANONICAL                        | Finance collection/party-ledger movement for the exact period                                                         |
| Receivable balance       | CANONICAL                        | Party-ledger balance reconstructed as of `period_end_at`, distinct from period movement                               |
| Purchases                | UNAVAILABLE                      | Current fields mix period activity and mutable status dates; no canonical purchase-activity contract yet              |
| Purchase payments        | UNAVAILABLE                      | No shared exact-period payment contract with stable source identities yet                                             |
| Supplier payable balance | UNAVAILABLE                      | Exact historical payable-at-end is not reliably reconstructed by the current snapshot path                            |
| Orders                   | UNAVAILABLE                      | Day Close still has a local operational query; no shared cross-system aggregation contract was established in 2.6A    |
| Items                    | UNAVAILABLE                      | Quantity and billed-value aggregations still lack canonical return/discount allocation and stable identity throughout |
| Categories               | UNAVAILABLE                      | Current item-line grouping is name-based and does not reconcile to a declared net-sales measure                       |
| Tables                   | UNAVAILABLE                      | Day Close still has a local table grouping; no shared cross-system aggregation contract was established in 2.6A       |
| Hourly sales             | UNAVAILABLE                      | Existing Day Close bucket is not yet a shared restaurant-local-time contract                                          |
| Customers                | DEFERRED ATTRIBUTION             | Stable customer identity is not frozen across all source rows                                                         |
| Staff                    | DEFERRED ATTRIBUTION             | Server attribution is not authoritative across all orders                                                             |
| Cashiers                 | DEFERRED ATTRIBUTION             | Collector identity is not consistently retained on every payment source                                               |
| Suppliers                | DEFERRED ATTRIBUTION             | Purchase evidence does not yet retain complete supplier/source identity                                               |

The unavailable and deferred rows are intentionally not converted to zero and
do not authorize Day Close 2.6B evidence UI work.

## 17. Day Close 2.6B frozen evidence contract

Day Close 2.6B is **VERSIONED EVIDENCE CONTRACT COMPLETE**. Operational detail
is now produced by `CanonicalOperationalReportingService` for the same exact UTC
half-open `[period_start_at, period_end_at)` boundary used by the canonical
financial contract. It does not replace `CanonicalReportingService`; financial
totals remain Finance-owned.

Future Day Close snapshots carry `day-close.evidence.v1`. Before confirmation
the evidence is live (`frozen=false`). Confirmation regenerates the snapshot at
the final server boundary, applies final drawer evidence, and stores that exact
payload as frozen with `frozen_at`. A later dated correction may refresh the
financial snapshot while preserving the previously frozen operational evidence.
Older snapshots without this schema remain compatible but explicitly have no
frozen evidence; clients must not reconstruct it from mutable current records.

Each evidence family carries an availability state, source, measure, timestamp
policy, attribution policy and warnings. `PARTIAL`, `UNAVAILABLE`, and
`DEFERRED_ATTRIBUTION` are presentation states, never zero values.

| Evidence family                | Availability             | Source and measure                                                                                                        |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Orders                         | AVAILABLE                | Completed/cancelled/order blockers classified by authoritative lifecycle timestamps                                       |
| Items / item rankings          | PARTIAL                  | Eligible quantity excludes rejected/voided units; subtotal is line price before unallocated order discount/refund effects |
| Categories                     | AVAILABLE                | Frozen category name from order-line snapshot; stable current category ID retained when resolvable                        |
| Tables / service               | AVAILABLE                | Explicit final order-table association; non-table service remains its actual service type                                 |
| Hourly sales                   | AVAILABLE                | Completion timestamp bucketed in the restaurant timezone                                                                  |
| Customers                      | PARTIAL                  | Only explicit `customer_id`; walk-in/free-text identities are not inferred                                                |
| Order creator / completer      | PARTIAL                  | Explicit user identities, kept separate by role                                                                           |
| Servers                        | DEFERRED_ATTRIBUTION     | No authoritative serving-user identity on every order                                                                     |
| Cashiers                       | DEFERRED_ATTRIBUTION     | Payment rows do not authoritatively retain the collecting user                                                            |
| Purchases / supplier rankings  | PARTIAL                  | Current posted purchases with stable purchase/supplier IDs; legacy general purchases are disclosed as uncovered           |
| Purchase payments              | PARTIAL                  | Explicit supplier-payment finance events                                                                                  |
| Supplier payable at period end | PARTIAL                  | Party-ledger balance as of the close end, with migration caveats                                                          |
| Purchase returns               | PARTIAL                  | Current posted purchase returns; legacy return coverage is disclosed                                                      |
| Sales refunds                  | AVAILABLE                | Canonical Finance refund total remains authoritative                                                                      |
| Sales item returns             | UNAVAILABLE              | Refund documents do not reliably allocate every returned quantity to an order item                                        |
| Credit notes                   | PARTIAL                  | Finance owns the refund total; full credit-note source rows are not embedded by this operational contract                 |
| Drawers                        | AVAILABLE/NOT_APPLICABLE | Existing Day Close drawer evidence is attached only after final confirmation reconciliation                               |

Source rows retain stable IDs plus the names displayed when the evidence was
frozen. Order inclusion uses `completed_at` for completed orders and
`canceled_at` for cancelled orders; open blockers are kept separate. Customer,
staff, cashier, supplier, table, and category attribution is never guessed from
display strings, descriptions, amounts, or mutable present-day ownership.

The storage policy is `embedded_complete`: the versioned evidence is embedded in
the confirmed snapshot without silent top-N truncation. Large-volume storage is
therefore explicit and reviewable before any future normalized evidence-store
change. At 500 or 2,000 orders the contract remains complete rather than silently
dropping rows; query construction uses eager/batched relationships and grouped
aggregation instead of per-order relationship queries. A later linked evidence
store may change storage, but must preserve this schema/version and completeness
contract. Day Close 2.6B adds no evidence UI, email/export redesign, or Day Close
3 work.

## 18. Day Close 2.6C presentation consumption

`DayCloseEvidenceView` consumes `day-close.evidence.v1` without becoming a new
metric owner. Financial summary values are read directly from the canonical
`financial` payload. Order counts, item rankings, category item subtotals,
table/service attribution, local-hour buckets, customer attribution, purchasing
rows, and drawer evidence are rendered from their typed evidence families.

The UI may format, filter, paginate, and progressively disclose source rows. It
does not sum rows to recreate sales, collections, refunds, expenses, credit,
expected cash, receivables, supplier payable, or purchase totals. Payment-method
and payment-instrument rows display backend-owned buckets and do not become an
alternate collections total.

The visible label matches the measure: `Most sold items`, `Highest item
subtotal`, and `Sales by category (item subtotal)` are distinct. `PARTIAL`,
`UNAVAILABLE`, `NOT_APPLICABLE`, and `DEFERRED_ATTRIBUTION` remain semantic
states. An unavailable family is never rendered as a zero-value business event.

Live reports use the current evidence response and state that values may change.
Saved reports use frozen v1 evidence only. Older snapshots are handed to the
legacy saved-snapshot presentation; no current order, menu, table, customer,
staff, supplier, or drawer query is used to fill historical gaps.

## 19. Final presentation boundary

The section 18 rich-evidence UI direction is **superseded as a product surface**,
not deleted as a data contract. Day Close now consumes only the canonical
financial values required to finalize the period: sales, collections, credit
movement, refunds, expenses, expected cash, counted cash, and the server-owned
cash difference. React formats these values and never rebuilds them from orders
or evidence rows.

`day-close.evidence.v1` remains stored and available to server exports, support,
audit, and future compliance. Item, category, table, hourly, customer, staff,
supplier, purchase, and order evidence belongs to Analytics or the relevant
operational module. Posting, journals, suspense, trial balance, and account-level
evidence belong to Finance / Accounting. The normal Day Close UI shows only the
plain-language finance-check outcome and an authorized link when review is
required.
