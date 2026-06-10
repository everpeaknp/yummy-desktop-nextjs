# Yummy Financial Accounting Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the financial reporting and accounting spine needed for Yummy to match the useful parts of HotelSuite's restaurant POS finance system without copying competitor data or turning dashboards into fake accounting.

**Architecture:** Keep existing POS, order, payment, expense, purchase, day-close, and customer-credit flows as the operational source of events. Add a backend accounting layer with chart of accounts, ledger mappings, journal entries, journal lines, report endpoints, and backfill jobs. Frontend finance screens should consume backend report contracts instead of rebuilding financial numbers in the browser.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic migrations, Pydantic schemas, Next.js 14 App Router, TanStack Query style data fetching where already used, existing `apiClient`, existing RBAC permission catalog, XLSX export.

---

## Scope Check

This is not one feature. It is six connected subprojects:

1. Operational report parity from existing data.
2. Accounting master data: accounts, mappings, fiscal periods.
3. Journal posting engine.
4. Accounting reports: GL, trial balance, P&L, balance sheet, VAT.
5. Frontend finance/accounting UI.
6. Historical backfill and rollout controls.

Implement them in that order. Do not start with P&L UI. A P&L screen before journal posting will be another dashboard, not accounting.

## Edge-to-Edge Comparison

| Area | HotelSuite behavior observed | Current Yummy state | Required Yummy target |
| --- | --- | --- | --- |
| POS dashboard | POS summaries and settlement signals | Dashboard and analytics exist | Keep, but link to report drilldowns |
| Sales Book | Detailed bill/tax/payment/customer/product rows | No Sales Book route | Add backend Sales Book endpoint and UI |
| Sales Return | Dedicated sales-return reporting | Refunds exist as negative payments | Add refund/sales-return report |
| Sales Summary | Cards plus by payment/account/category/item | Income dashboard exists | Expand to backend report contract |
| Materialized/VAT | Taxable/tax-free/export-style tax report | Tax configs exist | Add VAT/sales materialized report |
| POS payments | All receipts by invoice, outlet, paid by, cashier | Payment data exists, no full list page | Add payment settlement report |
| Invoices | Invoice list with paid, balance, status, paid by, ledger name | Receipts page lists completed orders | Add invoice/settlement report |
| Day close/night audit | End-of-day and unsettled checks | Day-close is strong | Keep, integrate with journals |
| Chart of accounts | Full accounting account tree | Missing | Add account master |
| Ledger mapping | Maps POS concepts to ledgers | Missing | Add mapping by payment, tax, category, revenue |
| Vouchers/journals | Receipt/payment/contra/journal vouchers | Missing | Add journal entries and lines |
| General ledger | Ledger statement and account reports | Missing | Add GL report from journal lines |
| Trial balance | Debit/credit balances | Missing | Add report from journal lines |
| Profit & loss | Revenue, returns, COGS, expenses, profit | Dashboard profit exists, not ledger-backed | Add P&L from journal lines |
| Balance sheet | Assets/liabilities/equity | Missing | Add balance sheet from accounts |
| Customer/vendor ledger | Customer/vendor balances | Customer credit and suppliers exist | Add ledger dimensions and reports |

## Current Yummy Anchors

Use these existing surfaces instead of inventing parallel operational records:

- Orders and payments: `C:\yummy_backend\app\models\order_model.py`
- Sale compatibility table: `C:\yummy_backend\app\models\sales_model.py`
- Payment creation/update/refund hooks: `C:\yummy_backend\app\services\order_service.py`
- Customer credit repayment: `C:\yummy_backend\app\services\customer_service.py`
- Expenses: `C:\yummy_backend\app\models\expense_model.py`
- Manual income: `C:\yummy_backend\app\models\income_entry_model.py`
- Day-close snapshots and adjustments: `C:\yummy_backend\app\models\business_day_close_model.py`
- Permission catalog: `C:\yummy_backend\app\utils\permission_catalog.py`
- Frontend finance pages: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\app\(dashboard)\finance`
- Frontend endpoint registry: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`
- Frontend route permissions: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\role-permissions.ts`

## Non-Negotiable Design Rules

- [ ] Do not mutate old orders, payments, expenses, purchases, or day-close records during accounting backfill.
- [ ] Do not scrape, export, or copy competitor customer/financial data. Use their screen structure only as product reference.
- [ ] Do not calculate official financial reports in React. Backend report endpoints are authoritative.
- [ ] Do not use startup `ALTER TABLE` safety code for the accounting tables. Use Alembic migrations.
- [ ] Do not delete posted journal entries. Use reversal entries.
- [ ] Every journal entry must balance: sum debit equals sum credit.
- [ ] Every posting must be idempotent with a unique source/event key.
- [ ] Missing mappings must post to Suspense Account and appear in a mapping exception report.

---

## Phase 0: Finalize Boundaries and Baseline

### Task 0.1: Confirm accounting scope

**Decision:** Yummy should implement accounting for restaurant/hotel operations, not full ERP on day one.

- [ ] Confirm the first release covers sales, payments, refunds, customer credit, manual expenses, manual income, and general purchases.
- [ ] Defer payroll journal posting unless payroll payout already creates a paid expense candidate.
- [ ] Defer inventory COGS until recipes/stock-costing are reliable enough for cost accounting.

**Acceptance:**

- Sales, payments, expenses, customer credit, purchases, and day-close can be reported.
- P&L has revenue and expenses.
- COGS can show zero or mapped manual purchase cost until inventory costing is implemented.

### Task 0.2: Capture current report numbers

**Backend commands:**

- [ ] Run existing backend tests:
  - `cd C:\yummy_backend`
  - `.\venv\Scripts\python.exe -m pytest tests -q`
- [ ] Run frontend type/lint/build baseline:
  - `cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`
  - `npm run lint`
  - `npm run build`

**Acceptance:**

- Existing failures are documented before accounting work starts.
- Baseline income/day-close totals are captured for a known restaurant/date range.

---

## Phase 1: Report Parity from Existing Data

This phase gives visible HotelSuite-like screens quickly, without waiting for the full ledger.

### Task 1.1: Add backend finance report schemas

**Create:**

- `C:\yummy_backend\app\schema\finance_report_schema.py`

**Schemas:**

- `SalesBookRow`
- `SalesBookResponse`
- `InvoiceSettlementRow`
- `InvoiceSettlementResponse`
- `PaymentSettlementRow`
- `PaymentSettlementResponse`
- `VatSalesRow`
- `VatSalesResponse`
- `ReportExportRequest`

**Fields to include:**

- invoice/order number
- order id
- bill date
- completed date
- business line
- station/category type
- customer name
- customer phone
- customer PAN if available later
- subtotal
- discount
- taxable sales
- tax free sales
- tax amount
- service charge
- grand total
- paid amount
- balance due
- payment method
- instrument type/name
- cashier/actor where available
- refund amount
- status

**Acceptance:**

- Schemas support the observed HotelSuite Sales Book, All Invoices, All POS Payments, and VAT-style reports.

### Task 1.2: Add backend finance report repository

**Create:**

- `C:\yummy_backend\app\repositories\finance_report_repository.py`

**Queries:**

- [ ] `list_sales_book(...)`
- [ ] `list_invoice_settlements(...)`
- [ ] `list_payment_settlements(...)`
- [ ] `list_vat_sales(...)`

**Use existing tables:**

- `orders`
- `order_items`
- `order_payments`
- `customers`
- `users`
- `tax_configurations`

**Rules:**

- Sales Book is scoped by order completion date.
- Payment settlement is scoped by payment creation date.
- Refund report is scoped by negative payment creation date.
- Credit orders show paid method `credit` and balance due if not fully settled.

**Acceptance:**

- Pagination works.
- Date filters work.
- Business line filter works.
- Payment method and instrument filters work.
- Count and aggregate totals are returned with rows.

### Task 1.3: Add backend finance report service/controller

**Create:**

- `C:\yummy_backend\app\services\finance_report_service.py`
- `C:\yummy_backend\app\controller\finance_report_controller.py`

**Routes:**

- `GET /finance-reports/sales-book`
- `GET /finance-reports/invoices`
- `GET /finance-reports/payments`
- `GET /finance-reports/refunds`
- `GET /finance-reports/vat-sales`

**Permissions:**

- `finance.reports.sales.view`
- `finance.reports.invoices.view`
- `finance.reports.payments.view`
- `finance.reports.tax.view`
- `reports.export` for exports

**Acceptance:**

- Routes are added in `app/main.py`.
- OpenAPI exposes the contracts.
- Existing permission checks reject users without the relevant key.

### Task 1.4: Add frontend report endpoints and types

**Modify:**

- `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`

**Create:**

- `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\finance-reports.ts`

**Endpoint helpers:**

- `FinanceReportApis.salesBook(params)`
- `FinanceReportApis.invoices(params)`
- `FinanceReportApis.payments(params)`
- `FinanceReportApis.refunds(params)`
- `FinanceReportApis.vatSales(params)`

**Acceptance:**

- No route strings are hardcoded inside page components.

### Task 1.5: Add frontend report pages

**Create:**

- `app/(dashboard)/finance/reports/sales-book/page.tsx`
- `app/(dashboard)/finance/reports/invoices/page.tsx`
- `app/(dashboard)/finance/reports/payments/page.tsx`
- `app/(dashboard)/finance/reports/refunds/page.tsx`
- `app/(dashboard)/finance/reports/vat-sales/page.tsx`
- `components/finance/reports/report-filters.tsx`
- `components/finance/reports/report-table.tsx`
- `components/finance/reports/report-summary-strip.tsx`

**UI rules:**

- Dense operational tables.
- No marketing hero sections.
- Filters at top: date range, business line, station, payment method, instrument, customer, bill number.
- Export button uses backend data or full filtered result, not only visible page rows.

**Acceptance:**

- Admin/manager can open each report.
- Tables do not horizontally break on desktop.
- Mobile uses horizontal scroll for wide finance tables.
- Export includes all filtered rows.

---

## Phase 2: Accounting Master Data

### Task 2.1: Add accounting models and migration

**Create:**

- `C:\yummy_backend\app\models\accounting_model.py`
- `C:\yummy_backend\migrations\versions\20260603_accounting_foundation.py`

**Tables:**

- `chart_accounts`
- `ledger_mappings`
- `journal_entries`
- `journal_entry_lines`
- `fiscal_periods`
- `accounting_backfill_runs`

**Core columns:**

`chart_accounts`

- id
- restaurant_id
- code
- name
- account_type: asset, liability, equity, income, expense
- normal_balance: debit, credit
- parent_id
- system_key
- is_system
- is_active
- created_at
- updated_at

`ledger_mappings`

- id
- restaurant_id
- mapping_key
- account_id
- business_line
- payment_method
- instrument_type
- instrument_name
- tax_config_id
- expense_category_id
- revenue_category
- is_active

`journal_entries`

- id
- restaurant_id
- business_line
- entry_no
- entry_date
- posted_at
- source_type
- source_id
- event_type
- dedupe_key
- status
- memo
- reversed_entry_id
- created_by
- created_at

`journal_entry_lines`

- id
- journal_entry_id
- account_id
- debit
- credit
- customer_id
- supplier_id
- order_id
- payment_id
- expense_id
- purchase_id
- payment_method
- instrument_type
- instrument_name
- tax_config_id
- memo

**Constraints:**

- Unique account code per restaurant.
- Unique active mapping per mapping key/context.
- Unique journal dedupe key per restaurant.
- Check debit >= 0 and credit >= 0.
- Check not both debit and credit on same line.

**Acceptance:**

- Alembic migration upgrades and downgrades cleanly.
- Empty accounting tables do not affect existing POS flows.

### Task 2.2: Add accounting schemas/repository/service

**Create:**

- `app\schema\accounting_schema.py`
- `app\repositories\accounting_repository.py`
- `app\services\accounting_seed_service.py`

**Service methods:**

- `ensure_default_chart(restaurant_id)`
- `list_accounts(restaurant_id)`
- `create_account(payload)`
- `update_account(account_id, payload)`
- `list_mappings(restaurant_id)`
- `upsert_mapping(payload)`
- `get_account_for_mapping(context)`

**Default accounts:**

- 1000 Cash
- 1010 Card Clearing
- 1020 Fonepay Clearing
- 1030 Digital QR Clearing
- 1100 Accounts Receivable
- 1200 Inventory
- 2000 Accounts Payable
- 2100 VAT Payable
- 2200 Customer Advance or Unapplied Receipts
- 3000 Owner Equity
- 4000 Sales Revenue
- 4010 Room Revenue
- 4020 Service Charge Revenue
- 4090 Sales Returns
- 4100 Discount Contra Revenue
- 5000 Cost of Goods Sold
- 6000 Operating Expenses
- 6900 Cash Over/Short
- 9999 Suspense Account

**Acceptance:**

- A restaurant can be seeded repeatedly without duplicate accounts.
- Missing mappings resolve to Suspense Account and return a warning.

### Task 2.3: Add accounting controller and permissions

**Create:**

- `app\controller\accounting_controller.py`

**Modify:**

- `app\main.py`
- `app\utils\permission_catalog.py`
- `app\utils\permissions.py`
- frontend `lib\role-permissions.ts`

**Routes:**

- `GET /accounting/accounts`
- `POST /accounting/accounts`
- `PATCH /accounting/accounts/{account_id}`
- `GET /accounting/mappings`
- `PUT /accounting/mappings`
- `POST /accounting/seed-defaults`

**Permissions:**

- `finance.accounting.view`
- `finance.accounting.manage`
- `finance.ledger.view`
- `finance.ledger.post`
- `finance.ledger.reports.view`
- `finance.ledger.backfill`

**Acceptance:**

- Admin has access.
- Manager access depends on granted permission.
- Cashier cannot access accounting settings unless explicitly granted.

---

## Phase 3: Journal Posting Engine

### Task 3.1: Build posting service

**Create:**

- `app\services\accounting_posting_service.py`

**Core methods:**

- `post_completed_order(order_id, actor_id=None)`
- `post_order_payment(payment_id, actor_id=None)`
- `post_payment_update(payment_id, old_snapshot, new_snapshot, actor_id=None)`
- `post_payment_removal(payment_id, old_snapshot, actor_id=None)`
- `post_refund(payment_id, actor_id=None)`
- `post_customer_credit_repayment(payment_id, actor_id=None)`
- `post_expense(expense_id, actor_id=None)`
- `post_expense_reversal(expense_id, actor_id=None)`
- `post_general_purchase(purchase_id, actor_id=None)`
- `post_day_close_discrepancy(day_close_id, actor_id=None)`
- `reverse_entry(entry_id, reason, actor_id=None)`

**Posting mechanics:**

- Build lines in memory.
- Validate debit total equals credit total.
- Resolve accounts through `ledger_mappings`.
- Use Suspense Account if mapping is missing.
- Store `dedupe_key`.
- Never delete posted entries.

**Acceptance:**

- Posting same source/event twice returns the existing entry or no-ops.
- Unbalanced entries raise before database commit.
- Missing mappings are visible in response metadata.

### Task 3.2: Posting rules for sales and payments

**Source hooks:**

- `OrderService.add_payment`
- order completion path
- upfront payment creation path
- payment update path
- payment remove path
- refund path

**Recommended accounting rule:**

- Official sale revenue posts when order becomes completed.
- Payment settlement posts when payment is successful.
- If payment happens before completion, post to Customer Advance or Unapplied Receipts, then clear it when the order completes.
- Credit payment on the bill posts to Accounts Receivable.
- Customer credit repayment posts Cash/Card/Fonepay/Digital debit and Accounts Receivable credit.

**Completed order lines:**

- Debit payment settlement accounts or Accounts Receivable.
- Credit Sales Revenue by revenue category.
- Credit VAT Payable.
- Credit Service Charge Revenue, unless mapped as liability.
- Debit Discount Contra Revenue.

**Refund lines:**

- Debit Sales Returns or reverse Sales Revenue.
- Debit VAT Payable for tax reversal where applicable.
- Credit payment settlement account or Accounts Receivable.

**Acceptance:**

- A paid cash order creates balanced journal lines.
- A credit order increases Accounts Receivable.
- A customer repayment decreases Accounts Receivable.
- A refund creates reversal/return lines and does not delete original entries.

### Task 3.3: Posting rules for expenses and purchases

**Source hooks:**

- `ExpenseService.create_expense`
- `ExpenseService.update_expense`
- `ExpenseService.delete_expense`
- `GeneralPurchaseService.create_purchase`
- `GeneralPurchaseService.receive_purchase`
- `GeneralPurchaseService.return_purchase`

**Expense lines:**

- Debit mapped expense account.
- Credit mapped payment settlement account.

**Unpaid purchase lines:**

- Debit Inventory or mapped purchase/expense account.
- Credit Accounts Payable.

**Paid purchase lines:**

- Debit Inventory or mapped purchase/expense account.
- Credit mapped payment settlement account.

**Return lines:**

- Reverse purchase or post Purchase Return account if configured.

**Acceptance:**

- Expense and purchase flows continue to work if accounting posting fails only when accounting is explicitly enabled.
- Once accounting is enabled for a restaurant, posting errors are visible and auditable.

---

## Phase 4: Ledger Reports

### Task 4.1: Build accounting report service

**Create:**

- `app\services\accounting_report_service.py`
- `app\repositories\accounting_report_repository.py`

**Reports:**

- General Ledger
- Ledger Statement
- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Flow MVP
- VAT Summary
- Customer Ledger
- Vendor Ledger
- Mapping Exception Report

**Acceptance:**

- Trial balance always balances.
- P&L is calculated from journal lines, not from orders directly.
- Balance sheet uses account types and normal balances.
- VAT report agrees with Sales Book tax totals for the same date range.

### Task 4.2: Add accounting report controller

**Create:**

- `app\controller\accounting_report_controller.py`

**Routes:**

- `GET /accounting/reports/general-ledger`
- `GET /accounting/reports/ledger-statement`
- `GET /accounting/reports/trial-balance`
- `GET /accounting/reports/profit-loss`
- `GET /accounting/reports/balance-sheet`
- `GET /accounting/reports/cash-flow`
- `GET /accounting/reports/vat-summary`
- `GET /accounting/reports/customer-ledger`
- `GET /accounting/reports/vendor-ledger`
- `GET /accounting/reports/mapping-exceptions`

**Acceptance:**

- All reports support restaurant, business line, fiscal period/date range.
- CSV/XLSX export path is available for report rows.

---

## Phase 5: Frontend Accounting UI

### Task 5.1: Add frontend accounting endpoints/types

**Create:**

- `types\accounting.ts`

**Modify:**

- `lib\api\endpoints.ts`

**Helpers:**

- `AccountingApis.accounts`
- `AccountingApis.mappings`
- `AccountingApis.seedDefaults`
- `AccountingReportApis.trialBalance`
- `AccountingReportApis.profitLoss`
- `AccountingReportApis.balanceSheet`
- `AccountingReportApis.generalLedger`
- `AccountingReportApis.vatSummary`

**Acceptance:**

- Page components use typed helpers.
- No hardcoded backend URLs in UI.

### Task 5.2: Add finance/accounting route group

**Create:**

- `app\(dashboard)\finance\accounting\page.tsx`
- `app\(dashboard)\finance\accounting\chart-of-accounts\page.tsx`
- `app\(dashboard)\finance\accounting\ledger-mapping\page.tsx`
- `app\(dashboard)\finance\accounting\general-ledger\page.tsx`
- `app\(dashboard)\finance\accounting\trial-balance\page.tsx`
- `app\(dashboard)\finance\accounting\profit-loss\page.tsx`
- `app\(dashboard)\finance\accounting\balance-sheet\page.tsx`
- `app\(dashboard)\finance\accounting\vat-summary\page.tsx`

**Create components:**

- `components\finance\accounting\account-table.tsx`
- `components\finance\accounting\ledger-mapping-table.tsx`
- `components\finance\accounting\financial-report-filters.tsx`
- `components\finance\accounting\trial-balance-table.tsx`
- `components\finance\accounting\profit-loss-statement.tsx`
- `components\finance\accounting\balance-sheet-statement.tsx`
- `components\finance\accounting\mapping-exception-banner.tsx`

**Acceptance:**

- Finance UI has separate tabs for Reports and Accounting.
- Accounting screens are permission gated.
- Wide tables are usable on desktop and scroll on mobile.

### Task 5.3: Extend settings for ledger mapping

**Modify:**

- `app\(dashboard)\manage\settings\page.tsx`
- `app\(dashboard)\manage\taxes\page.tsx`
- `app\(dashboard)\finance\expenses\page.tsx`

**Add mapping selectors for:**

- cash
- each card machine
- each static QR
- fonepay
- credit/customer receivable
- tax/VAT
- service charge
- expense categories
- revenue categories

**Acceptance:**

- Admin can see which ledger account each payment instrument/category posts to.
- Missing mappings are highlighted before transactions go to Suspense.

---

## Phase 6: Historical Backfill

### Task 6.1: Add dry-run backfill service

**Create:**

- `app\services\accounting_backfill_service.py`

**Backfill sources:**

- completed orders
- order payments
- negative payments/refunds
- customer credit repayments
- expenses
- general purchases
- day-close discrepancies

**Modes:**

- dry run
- commit

**Dry-run output:**

- source counts
- expected journal count
- expected debit total
- expected credit total
- missing mapping count
- suspense amount
- sample exceptions

**Acceptance:**

- Dry run can be executed without writing journal rows.
- Commit mode can be repeated without duplicates.

### Task 6.2: Add backfill endpoint

**Create route:**

- `POST /accounting/backfill/dry-run`
- `POST /accounting/backfill/commit`
- `GET /accounting/backfill/runs`

**Permission:**

- `finance.ledger.backfill`

**Acceptance:**

- Only admin or explicitly permissioned users can run it.
- Backfill run status is stored.
- Commit requires a dry-run id.

---

## Phase 7: Verification and Rollout

### Task 7.1: Backend test suite

**Create tests:**

- `tests/accounting_chart_spec.py`
- `tests/accounting_posting_order_spec.py`
- `tests/accounting_posting_expense_spec.py`
- `tests/accounting_reports_spec.py`
- `tests/accounting_backfill_spec.py`
- `tests/finance_reports_spec.py`

**Required scenarios:**

- cash order
- card order with instrument
- digital QR order with instrument
- fonepay order
- credit order
- customer credit repayment
- refund
- expense
- unpaid purchase
- paid purchase
- missing mapping to Suspense
- trial balance balances
- P&L agrees with posted revenue/expense lines

**Acceptance:**

- `pytest tests/accounting_* tests/finance_reports_spec.py -q` passes.

### Task 7.2: Frontend verification

**Commands:**

- `npm run lint`
- `npm run build`

**Browser checks:**

- `/finance/reports/sales-book`
- `/finance/reports/invoices`
- `/finance/reports/payments`
- `/finance/accounting/chart-of-accounts`
- `/finance/accounting/ledger-mapping`
- `/finance/accounting/trial-balance`
- `/finance/accounting/profit-loss`

**Acceptance:**

- No overlapping text.
- Empty states explain missing mappings/data.
- Export buttons are disabled only when no data is available.

### Task 7.3: Reconciliation checks before enabling

For one restaurant and one date range:

- [ ] Sales Book gross/tax/discount totals match existing order totals.
- [ ] Payment settlement totals match existing order payment totals by method/instrument.
- [ ] Expense totals match existing expense summary.
- [ ] Trial balance debit total equals credit total.
- [ ] P&L revenue matches journal revenue, not frontend-calculated dashboard values.
- [ ] Suspense balance is reviewed and mapped down.

**Acceptance:**

- Accounting feature can be enabled per restaurant after reconciliation.

---

## Recommended First Implementation Slice

Build this first:

1. `GET /finance-reports/sales-book`
2. `GET /finance-reports/payments`
3. Frontend Sales Book page
4. Frontend Payments page
5. Permission keys for finance reports
6. Export for both reports

Why this first:

- It produces immediate HotelSuite-style value.
- It uses existing data.
- It exposes data quality issues before ledger posting.
- It avoids building P&L on weak foundations.

Then build:

1. Chart of accounts.
2. Ledger mappings.
3. Journal posting for completed orders and payments.
4. Trial balance.
5. P&L.

## Risk Register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Posting duplicate journals | Financial reports become wrong | Dedupe key per source/event |
| Missing mappings | Money disappears into wrong accounts | Suspense Account and exception report |
| Frontend-calculated reports | Audit mismatches | Backend report contracts only |
| Editing posted payments | Ledger can diverge | Reversal entry, then repost |
| Old data quality gaps | Backfill may not reconcile | Dry-run backfill with exception list |
| Expense enum mismatch | Payment settlement reports incomplete | Use shared `PaymentMethodEnum` everywhere |
| COGS uncertainty | P&L may overclaim profit accuracy | Defer inventory COGS until costing is reliable |

## Definition of Done

- Admin can open Sales Book, Invoices, Payments, VAT, Chart of Accounts, Ledger Mapping, GL, Trial Balance, P&L, and Balance Sheet.
- Completed orders, payments, refunds, expenses, purchases, and credit repayments create balanced journal entries.
- Historical data can be backfilled with no duplicate journals.
- Trial balance is always balanced.
- P&L is ledger-backed.
- Missing mappings are visible and actionable.
- Existing income, expense, receipts, day-close, and checkout flows still work.
