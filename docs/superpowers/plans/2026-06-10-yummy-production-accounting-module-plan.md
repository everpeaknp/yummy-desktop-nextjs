# Yummy Production Accounting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Yummy's current accounting MVP into a production-grade accounting module that matches HotelSuite's useful accounting/reporting workflows and becomes better through explainability, reconciliation, and audit controls.

**Architecture:** Keep the existing `finance_events -> ledger_mappings -> journal_entries/journal_lines -> reports` spine. Add an accounting control layer around it: setup, opening balances, fiscal periods, locks, manual vouchers, reversals, AR/AP aging, settlement reconciliation, VAT validation/export, source drilldowns, station dimensions, and approval permissions.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, PostgreSQL, pytest, Next.js App Router, TypeScript, React, existing API proxy/client patterns.

---

## Current Baseline

Yummy already has:

- Canonical finance events: `C:\yummy_backend\app\models\finance_event_model.py`
- Accounting master data and journal tables: `C:\yummy_backend\app\models\accounting_model.py`
- Accounting services/reports: `C:\yummy_backend\app\services\accounting_service.py`
- Accounting backfill: `C:\yummy_backend\app\services\accounting_backfill_service.py`
- Accounting API: `C:\yummy_backend\app\controller\accounting_controller.py`
- Accounting schemas: `C:\yummy_backend\app\schema\accounting_schema.py`
- Accounting UI/types/endpoints:
  - `types/accounting.ts`
  - `lib/api/endpoints.ts`
  - `components/finance/accounting/*`
  - `app/(dashboard)/finance/accounting/*`
- Operational finance reports:
  - `C:\yummy_backend\app\controller\finance_report_controller.py`
  - `C:\yummy_backend\app\services\finance_report_service.py`
  - `components/finance/reports/operational-finance-report-client.tsx`
  - `app/(dashboard)/finance/reports/*`

The current module is an accounting spine MVP. The production gap is not mainly "more reports"; it is accounting governance: opening balances, period locking, reversals, audit trail, reconciliations, permissions, and clear drilldown.

## Better Than HotelSuite Strategy

Do not copy HotelSuite screen-for-screen. Build an accounting module that is easier to trust:

1. **Every number must explain itself.** A report total must drill down to journal lines, finance events, and source orders/payments/refunds/expenses.
2. **No silent edits after posting.** Posted accounting records are corrected by reversal entries, not destructive updates.
3. **Close periods with preflight checks.** The system should refuse locking if trial balance is unbalanced, suspense exists, VAT totals disagree, or day closes are missing.
4. **Show reconciliation status everywhere.** Payment methods, bank deposits, Fonepay/Card settlement, VAT export, AR/AP balances, and day-close cash should show matched/unmatched/variance.
5. **Use finance events as the audit backbone.** Operational reports, accounting, analytics, and exports must reconcile through the same event source.
6. **Station/outlet is a first-class reporting dimension.** HotelSuite-style reports often feel broad; Yummy should support station/outlet drilldowns without breaking accounting totals.
7. **Make accountant onboarding guided.** A setup checklist should show accounts seeded, mappings complete, opening balances posted, backfill complete, no suspense, and current period open.

---

## Phase 0: Baseline, Feature Flag, and Accounting Health Check

**Purpose:** Prevent more accounting changes from being judged by screenshots alone.

**Backend files:**

- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_health_spec.py`

**Frontend files:**

- Modify: `types/accounting.ts`
- Modify: `lib/api/endpoints.ts`
- Modify: `components/finance/accounting/accounting-overview-client.tsx`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

Tasks:

- [x] Add `GET /accounting/health` returning:
  - `accounts_seeded`
  - `mappings_seeded`
  - `opening_balances_posted`
  - `latest_backfill_status`
  - `unposted_finance_events`
  - `trial_balance_difference`
  - `missing_mapping_count`
  - `suspense_amount`
  - `open_period`
  - `locked_period_violations`
  - `vat_sales_difference`
  - `payment_settlement_variance`
- [x] Add backend tests proving the health endpoint returns red/yellow/green statuses.
- [x] Add an Accounting Health panel on the accounting overview page.
- [x] Keep existing accounting screens usable while health checks are incomplete.

Acceptance:

- Trial balance difference, suspense amount, unposted events, and missing mappings are visible before the user opens detailed reports.
- This becomes the first screen for accountants, not a buried debugging tool.

Verification:

- `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_health_spec.py -q`
- `cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs && npm test -- scripts/__tests__/accounting-ui-contract.test.js`

---

## Phase 1: Accounting Setup and Default Configuration

**Purpose:** Make accounting automatic for every restaurant, not only restaurant 52 or any manually seeded restaurant.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_accounting_setup.py`

Add tables:

- `accounting_settings`
  - `id`
  - `restaurant_id`
  - `base_currency`
  - `fiscal_year_start_month`
  - `fiscal_year_start_day`
  - `vat_registration_number`
  - `ird_sync_enabled`
  - `accounting_enabled_at`
  - `created_at`
  - `updated_at`
- `accounting_setup_runs`
  - `id`
  - `restaurant_id`
  - `status`
  - `accounts_created`
  - `mappings_created`
  - `warnings_json`
  - `created_at`
  - `completed_at`

**Backend files:**

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Create: `C:\yummy_backend\app\services\accounting_setup_service.py`
- Create: `C:\yummy_backend\app\schema\accounting_setup_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Modify: `C:\yummy_backend\app\services\restaurant_services.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_setup_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/setup/page.tsx`
- Create: `components/finance/accounting/accounting-setup-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Modify: `types/accounting.ts`
- Modify: `lib/api/endpoints.ts`

Tasks:

- [x] Add accounting settings model/schema.
- [x] Add `AccountingSetupService.ensure_restaurant_accounting_ready(restaurant_id)`.
- [x] Call setup service when a restaurant is created and when accounting is opened for an existing restaurant.
- [x] Make setup idempotent: repeated setup must not duplicate accounts or mappings.
- [x] Add setup UI with status cards and a "Repair setup" action.
- [x] Add tests for new restaurant setup, existing restaurant repair, and duplicate-safe seeding.

Acceptance:

- Every restaurant can open accounting without manually seeding accounts.
- Missing default accounts/mappings can be repaired without developer SQL.

Better-than-HotelSuite detail:

- Show a transparent setup checklist instead of hiding configuration errors until reports show zero.

---

## Phase 2: Opening Balance Setup

**Purpose:** Allow a restaurant to start ledger accounting from an existing real-world balance sheet.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_opening_balances.py`

Add tables:

- `opening_balance_batches`
  - `id`
  - `restaurant_id`
  - `as_of_date`
  - `status` = `draft | posted | reversed`
  - `debit_total`
  - `credit_total`
  - `journal_entry_id`
  - `created_by_id`
  - `posted_by_id`
  - `posted_at`
  - `reversed_by_entry_id`
  - `created_at`
- `opening_balance_lines`
  - `id`
  - `batch_id`
  - `account_id`
  - `debit`
  - `credit`
  - `party_type`
  - `party_id`
  - `memo`

**Backend files:**

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Create: `C:\yummy_backend\app\services\opening_balance_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_opening_balances_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/opening-balances/page.tsx`
- Create: `components/finance/accounting/opening-balance-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Modify: `types/accounting.ts`
- Modify: `lib/api/endpoints.ts`

API:

- `GET /accounting/opening-balances?restaurant_id=...`
- `POST /accounting/opening-balances`
- `PATCH /accounting/opening-balances/{batch_id}`
- `POST /accounting/opening-balances/{batch_id}/post`
- `POST /accounting/opening-balances/{batch_id}/reverse`

Rules:

- Draft can be edited.
- Posted cannot be edited.
- Posted opening balance creates one balanced journal entry.
- Reversal creates a new reversing journal entry and marks the batch reversed.
- Only one active posted opening balance batch per restaurant.
- Opening balances cannot be posted inside a locked period.

Acceptance:

- Trial balance includes opening balances.
- Balance sheet can be correct before any POS transaction exists.
- Reversing opening balances does not delete original postings.

Better-than-HotelSuite detail:

- Add an import-friendly grid so accountants can paste trial balance rows from Excel and see debit/credit difference live.

---

## Phase 3: Fiscal Periods, Month Close, and Locked Periods

**Purpose:** Stop accounting reports from changing after a month is finalized.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_accounting_periods.py`

Add tables:

- `fiscal_years`
  - `id`
  - `restaurant_id`
  - `year_label`
  - `start_date`
  - `end_date`
  - `status` = `open | closed | locked`
- `accounting_periods`
  - `id`
  - `restaurant_id`
  - `fiscal_year_id`
  - `period_type` = `month | quarter | year`
  - `period_label`
  - `start_date`
  - `end_date`
  - `status` = `open | soft_closed | locked | reopened`
  - `closed_by_id`
  - `closed_at`
  - `locked_by_id`
  - `locked_at`
  - `reopened_by_id`
  - `reopened_at`
  - `close_snapshot_json`
  - `source_hash`

**Backend files:**

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Create: `C:\yummy_backend\app\services\accounting_period_service.py`
- Create: `C:\yummy_backend\app\utils\accounting_lock_guard.py`
- Modify: `C:\yummy_backend\app\services\finance_event_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\services\day_close_service.py`
- Modify: `C:\yummy_backend\app\services\period_close_service.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_period_lock_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/periods/page.tsx`
- Create: `components/finance/accounting/accounting-periods-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`

API:

- `GET /accounting/periods`
- `POST /accounting/periods/generate`
- `POST /accounting/periods/{period_id}/soft-close`
- `POST /accounting/periods/{period_id}/lock`
- `POST /accounting/periods/{period_id}/reopen`
- `GET /accounting/periods/{period_id}/preflight`

Lock preflight must check:

- Trial balance difference is zero.
- No unposted finance events in the period.
- No missing ledger mappings.
- Suspense amount is zero or explicitly approved.
- Sales Book VAT totals match VAT Summary.
- Day closes are confirmed for each business date in the period.
- No payment settlement batch has unresolved variance above configured tolerance.

Rules:

- Operational corrections in locked periods must post reversal/adjustment entries in the currently open period.
- Refunds after a locked sales date post on refund date, not original order date.
- Backfill cannot mutate locked periods unless the user has an override permission and the action is audit-logged.

Acceptance:

- A locked month cannot silently change P&L, Balance Sheet, VAT, Sales Book, or payment reports.

Better-than-HotelSuite detail:

- Show a close checklist with exact blockers and clickable fixes.

---

## Phase 4: Manual Journal Vouchers and Approval Workflow

**Purpose:** Let accountants record adjustments that do not originate from POS operations.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_manual_journal_vouchers.py`

Extend:

- `journal_entries`
  - `entry_number`
  - `voucher_type` = `system | journal | receipt | payment | contra | opening_balance | adjustment | reversal`
  - `approval_status` = `draft | submitted | approved | rejected | posted | reversed`
  - `period_id`
  - `business_line`
  - `station`
  - `created_by_id`
  - `submitted_by_id`
  - `approved_by_id`
  - `posted_by_id`
  - `reversal_of_entry_id`
  - `reversed_by_entry_id`
  - `external_reference`
  - `metadata_json`
- `journal_lines`
  - `line_no`
  - `party_type`
  - `party_id`
  - `business_line`
  - `station`

**Backend files:**

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Create: `C:\yummy_backend\app\services\journal_voucher_service.py`
- Create: `C:\yummy_backend\app\services\journal_numbering_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_journal_vouchers_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/vouchers/page.tsx`
- Create: `app/(dashboard)/finance/accounting/vouchers/[id]/page.tsx`
- Create: `components/finance/accounting/journal-voucher-client.tsx`
- Create: `components/finance/accounting/journal-voucher-form.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`

API:

- `GET /accounting/journal-vouchers`
- `POST /accounting/journal-vouchers`
- `PATCH /accounting/journal-vouchers/{entry_id}`
- `POST /accounting/journal-vouchers/{entry_id}/submit`
- `POST /accounting/journal-vouchers/{entry_id}/approve`
- `POST /accounting/journal-vouchers/{entry_id}/reject`
- `POST /accounting/journal-vouchers/{entry_id}/post`

Rules:

- Draft vouchers can be edited.
- Submitted vouchers cannot be edited except by returning to draft/rejecting.
- Posted vouchers cannot be edited.
- Debits must equal credits before submit/post.
- Voucher date cannot be inside a locked period.
- Posting creates journal lines visible in GL, Trial Balance, P&L, and Balance Sheet.

Acceptance:

- Accountants can make real adjusting entries without developer help.
- The UI prevents unbalanced vouchers before submit.

Better-than-HotelSuite detail:

- Add "impact preview" before posting: affected Trial Balance accounts, P&L movement, Balance Sheet movement.

Implementation status on 2026-06-10:

- [x] Added manual voucher metadata columns and local database migration.
- [x] Added backend voucher numbering, draft/update/submit/approve/reject/post service, schemas, and API routes.
- [x] Excluded draft/submitted/approved/rejected manual vouchers from accounting reports until `approval_status = posted`.
- [x] Added backend tests for voucher lifecycle, locked-period protection, balanced-entry validation, and route coverage.
- [x] Added frontend voucher types, API helpers, nav item, voucher register, detail drilldown, and voucher creation form.
- [x] Added client-side debit/credit validation and a first-pass impact preview.
- [ ] Add a backend-powered impact preview endpoint that compares the voucher against current Trial Balance/P&L/Balance Sheet before posting.

---

## Phase 5: Journal Reversal Workflow

**Purpose:** Replace silent correction with auditable reversal.

**Backend files:**

- Modify: `C:\yummy_backend\app\services\journal_voucher_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_journal_reversals_spec.py`

**Frontend files:**

- Modify: `components/finance/accounting/accounting-report-client.tsx`
- Modify: `components/finance/accounting/journal-voucher-client.tsx`
- Modify: `components/finance/accounting/journal-voucher-detail-client.tsx`
- Create: `components/finance/accounting/reverse-journal-dialog.tsx`

API:

- `POST /accounting/journal-entries/{entry_id}/reverse`

Rules:

- Reversal creates a new journal entry with debit/credit swapped.
- Original entry status becomes `reversed`.
- Original entry stores `reversed_by_entry_id`.
- Reversal entry stores `reversal_of_entry_id`.
- Reversal date must be in an open period.
- System-generated entries can be reversed only by workflows that own the source, unless a high-level accounting override permission is present.

Acceptance:

- A wrong manual voucher can be reversed cleanly.
- Locked-period entries are corrected in the current open period, not edited in place.

Better-than-HotelSuite detail:

- Show original and reversing entry side-by-side with net zero effect.

Implementation status on 2026-06-10:

- [x] Added backend reversal request schema, service logic, and API route.
- [x] Added tests for posted voucher reversal, locked-period correction date, duplicate reversal blocking, and system-entry override blocking.
- [x] Updated accounting report filters so reversed originals remain visible and offset through the reversing entry instead of disappearing from history.
- [x] Added frontend reversal input type, API helper, reusable reverse dialog, voucher-register action, and voucher-detail action.
- [x] Added General Ledger drilldown links for manual voucher and journal reversal rows.
- [x] Verified the focused backend accounting suite, accounting UI contract test, and TypeScript compile.
- [ ] Add true side-by-side original-vs-reversing-entry comparison UI with net-zero account impact.
- [ ] Add permission-gated system-entry override workflow; normal UI currently does not expose the override flag.

---

## Phase 6: AR/AP Aging and Statements

**Purpose:** Make customer receivables and supplier payables understandable, not just ledger rows.

**Backend files:**

- Create: `C:\yummy_backend\app\services\accounting_aging_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_aging_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/ar-aging/page.tsx`
- Create: `app/(dashboard)/finance/accounting/ap-aging/page.tsx`
- Create: `components/finance/accounting/aging-report-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Modify: `types/accounting.ts`
- Modify: `lib/api/endpoints.ts`

API:

- `GET /accounting/ar-aging`
- `GET /accounting/ap-aging`
- `GET /accounting/customer-statement`
- `GET /accounting/supplier-statement`

Buckets:

- `current`
- `1_7`
- `8_15`
- `16_30`
- `31_60`
- `61_90`
- `over_90`

Rules:

- AR aging is based on unpaid credit-sale/invoice balances, not raw sales totals.
- AP aging is based on supplier payable creation minus payments/returns.
- Customer/supplier statements show opening balance, period movement, closing balance.

Acceptance:

- A credit customer balance can be traced to invoices, payments, refunds, and adjustments.
- A supplier payable can be traced to purchase, return, payment, and adjustment.

Better-than-HotelSuite detail:

- Add "why balance changed" bridge: opening balance + new invoices - receipts - refunds/returns + adjustments = closing balance.

Implementation status on 2026-06-10:

- [x] Added backend `AccountingAgingService` with AR and AP FIFO aging buckets.
- [x] Added `GET /accounting/ar-aging`, `GET /accounting/ap-aging`, `GET /accounting/customer-statement`, and `GET /accounting/supplier-statement`.
- [x] Added backend schemas and tests for aging bucket allocation, statement bridge totals, and route coverage.
- [x] Added frontend aging response types and accounting API helpers.
- [x] Added `AR Aging` and `AP Aging` accounting pages, nav links, bucket tables, and statement bridge UI.
- [ ] Move aging from posted finance-event movements to invoice-level allocation and journal-line party balances once all source flows carry party metadata.
- [ ] Add searchable customer/supplier pickers and statement export.

---

## Phase 7: Bank, Card, Digital, and Fonepay Settlement Reconciliation

**Purpose:** Collections in POS are not the same as bank-settled money. This is one of the biggest real-world accounting gaps.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_payment_settlement_reconciliation.py`

Add tables:

- `payment_settlement_batches`
  - `id`
  - `restaurant_id`
  - `payment_method`
  - `instrument`
  - `settlement_date`
  - `expected_amount`
  - `actual_amount`
  - `fee_amount`
  - `variance_amount`
  - `status` = `draft | matched | variance_approved | posted | reversed`
  - `journal_entry_id`
  - `created_by_id`
  - `posted_by_id`
  - `created_at`
  - `posted_at`
- `payment_settlement_lines`
  - `id`
  - `batch_id`
  - `payment_id`
  - `finance_event_id`
  - `gross_amount`
  - `fee_amount`
  - `net_amount`

**Backend files:**

- Create: `C:\yummy_backend\app\services\payment_settlement_service.py`
- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_payment_settlement_reconciliation_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/settlements/page.tsx`
- Create: `components/finance/accounting/settlement-reconciliation-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`

API:

- `GET /accounting/settlements`
- `POST /accounting/settlements/preview`
- `POST /accounting/settlements`
- `POST /accounting/settlements/{batch_id}/match`
- `POST /accounting/settlements/{batch_id}/approve-variance`
- `POST /accounting/settlements/{batch_id}/post`
- `POST /accounting/settlements/{batch_id}/reverse`

Rules:

- Cash does not need bank settlement, but it needs day-close cash reconciliation.
- Card/digital/Fonepay settlements compare POS collections to actual bank/processor deposits.
- Processor fees post to bank charges expense.
- Variances post to cash over/short or settlement variance only with permission.

Acceptance:

- Fonepay/Card reports can show collected, settled, fees, unsettled, and variance.
- Cash expected remains day-close-focused; non-cash settlement becomes bank-focused.

Better-than-HotelSuite detail:

- Add settlement bridge: POS collections - refunds - processor fees +/- variance = bank deposit.

**Implementation status - 2026-06-10: implemented MVP**

- Backend:
  - Added `payment_settlement_batches` and `payment_settlement_lines` models and migration.
  - Added `PaymentSettlementService` with preview, create, match, approve variance, post, reverse, and list workflows.
  - Cash is explicitly rejected from this workflow and remains day-close-only.
  - Card, digital, and Fonepay settlement posting now creates balanced journals:
    - debit Bank (`1040`) for actual deposit
    - debit Bank Charges (`6200`) for processor fees
    - debit or credit Settlement Variance (`6905`) for approved variance
    - credit the payment clearing account (`1010`, `1020`, or `1030`) for expected POS net settlement
  - Settlement reversal uses a real reversal journal, not deletion.
- Frontend:
  - Added `/finance/accounting/settlements`.
  - Added settlement nav item, typed API helpers, and typed accounting settlement payload/response models.
  - Added UI bridge for POS collections, refunds, processor fees, settlement variance, and bank deposit.
- Verification:
  - Backend focused accounting suite: `22 passed`.
  - Frontend accounting contract: `14 passed`.
  - Frontend TypeScript: passed.

**Known hardening left**

- Import processor or bank settlement files instead of manual deposit entry only.
- Store processor reference numbers and settlement statement IDs.
- Add permission-specific approval for settlement variance instead of relying only on the current accounting route permission.
- Extend settlement support if Yummy adds more non-cash payment methods beyond card, digital, and Fonepay.

---

## Phase 8: Nepal VAT / Materialized Report Validation and Export

**Purpose:** Make VAT reports compliance-grade, not just a tax summary screen.

**Backend data model:**

Create Alembic migration:

- `C:\yummy_backend\migrations\versions\20260610_vat_export_runs.py`

Add tables:

- `vat_export_runs`
  - `id`
  - `restaurant_id`
  - `date_from`
  - `date_to`
  - `business_line`
  - `status`
  - `sales_book_total`
  - `vat_summary_total`
  - `difference`
  - `row_count`
  - `validation_errors_json`
  - `export_file_url`
  - `created_by_id`
  - `created_at`

**Backend files:**

- Create: `C:\yummy_backend\app\services\vat_materialized_export_service.py`
- Modify: `C:\yummy_backend\app\services\finance_report_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\schema\finance_report_schema.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_vat_materialized_export_spec.py`

**Frontend files:**

- Create: `app/(dashboard)/finance/accounting/vat-export/page.tsx`
- Create: `components/finance/accounting/vat-export-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`

API:

- `GET /accounting/vat-export/runs`
- `POST /accounting/vat-export/validate`
- `POST /accounting/vat-export/generate`
- `GET /accounting/vat-export/{run_id}/download`

Validation:

- Sales Book tax total equals accounting VAT Summary tax total for the same filters.
- Refund tax reversals link to original invoice/reference where available.
- Credit notes have reason, date, amount, and tax reversal amount.
- Voided/cancelled bills are separated from valid sales.
- Export uses exact date windows and timezone.

Acceptance:

- VAT export refuses generation when report totals disagree.
- VAT export run keeps a permanent audit record.

Better-than-HotelSuite detail:

- Add validation errors that link directly to the bad order/refund/journal line.

**Implementation status - 2026-06-10: implemented MVP**

- Backend:
  - Added `vat_export_runs` audit model and migration.
  - Added `VatMaterializedExportService` with validate, generate, list, and CSV download workflows.
  - Validation compares operational VAT Sales tax total to ledger-backed VAT Summary net tax payable for the same restaurant/date/business-line filters.
  - Generation refuses to export when validation fails and still stores a failed audit run with validation error details.
  - Generated exports store `export_file_url` and can be downloaded as CSV from the stored run.
  - Added API routes:
    - `GET /accounting/vat-export/runs`
    - `POST /accounting/vat-export/validate`
    - `POST /accounting/vat-export/generate`
    - `GET /accounting/vat-export/{run_id}/download`
- Frontend:
  - Added `/finance/accounting/vat-export`.
  - Added typed VAT export request/run models and accounting API helpers.
  - Added VAT Export nav item, validation bridge cards, validation error display, run history, generate action, and CSV download action.
- Verification:
  - Backend VAT export spec passes.
  - Frontend accounting contract passes.
  - Frontend TypeScript and backend Python syntax checks pass.

**Known hardening left**

- Add station filter support once station-wise VAT export requirements are finalized.
- Validate credit-note/refund rows against `order_refunds` once all refund flows consistently populate credit note fields.
- Add IRD-specific column layout/export format after confirming the exact production schema expected by Nepal IRD/CBMS.
- Add row-level source links to bad order/refund/journal lines through the Phase 9 drilldown work.

---

## Phase 9: Drilldown From Every Number to Source

**Purpose:** Make accounting explainable to non-accountants and useful for debugging.

**Backend files:**

- Create: `C:\yummy_backend\app\services\accounting_drilldown_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\services\finance_report_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_drilldown_spec.py`

**Frontend files:**

- Create: `components/finance/accounting/accounting-drilldown-drawer.tsx`
- Modify: `components/finance/accounting/accounting-report-client.tsx`
- Modify: `components/finance/accounting/profit-loss-statement.tsx`
- Modify: `components/finance/accounting/balance-sheet-statement.tsx`
- Modify: `components/finance/accounting/trial-balance-table.tsx`
- Modify: `components/finance/reports/operational-finance-report-client.tsx`

API:

- `GET /accounting/drilldown`
- `GET /accounting/journal-entries/{entry_id}`
- `GET /accounting/source-trace?source_type=...&source_id=...`

Drilldown chain:

- Report number
- Account or metric
- Journal lines
- Journal entry
- Finance event
- Operational source:
  - order
  - payment
  - refund
  - manual expense
  - inventory movement
  - supplier payment
  - manual voucher

Acceptance:

- Clicking a P&L revenue row can show the journal lines and source sales.
- Clicking a Trial Balance account can show GL lines.
- Clicking a GL line can show source order/payment/refund where available.

Better-than-HotelSuite detail:

- Add a "trace path" visual: Report -> Journal -> Finance Event -> Source.

Implementation status - 2026-06-10: implemented MVP.

- Backend:
  - Added `AccountingDrilldownService` with account, journal-entry, journal-line, finance-event, and source filters.
  - Added typed drilldown/source-trace schemas.
  - Added `GET /accounting/drilldown`, `GET /accounting/journal-entries/{entry_id}`, and `GET /accounting/source-trace`.
  - Added focused backend tests for report-to-source tracing and controller route contracts.
- Frontend:
  - Added typed endpoint helpers for drilldown, journal entry fetch, and source trace.
  - Added `AccountingDrilldownDrawer` with the trace path visual.
  - Wired Trace actions into General Ledger, Profit & Loss, Balance Sheet, VAT Summary, and Trial Balance rows.
- Known hardening left:
  - Operational finance report drilldowns are not wired yet.
  - Source-specific detail panels still stop at source ids; richer order/payment/refund previews should be added per source type.
  - Station-scoped drilldown depends on Phase 10 journal station dimensions.

---

## Phase 10: Station / Outlet-Wise Accounting Reports

**Purpose:** Make station comparisons accurate without breaking accounting totals.

**Backend files:**

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\services\finance_report_service.py`
- Modify: `C:\yummy_backend\app\services\finance_event_service.py`
- Modify: `C:\yummy_backend\app\services\order_service.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_station_reports_spec.py`

**Frontend files:**

- Modify: `components/finance/accounting/financial-report-filters.tsx`
- Modify: `components/finance/accounting/accounting-report-client.tsx`
- Modify: `components/finance/reports/operational-finance-report-client.tsx`
- Modify: `types/accounting.ts`

Rules:

- `finance_events.station` remains the source dimension.
- `journal_entries.station` and `journal_lines.station` should be populated where the source event has a single station.
- Mixed-station orders should remain unassigned at entry level and be allocated only when item-level costing/revenue data exists.
- All station-filtered report totals must reconcile to unfiltered total when summed across stations plus "unassigned".

Acceptance:

- Sales Book, Payments, GL, Trial Balance, P&L, VAT, AR/AP, and settlement reports support station filter.
- Station totals must not invent precision for mixed-station orders.

Better-than-HotelSuite detail:

- Show an "Unassigned / mixed station" bucket instead of hiding ambiguous data.

Implementation status - 2026-06-10: implemented MVP.

- Backend:
  - Finance-event station now propagates to generated journal entries and journal lines.
  - Accounting report services now accept `station` for GL, Trial Balance, P&L, Balance Sheet, VAT Summary, mapping exceptions, customer ledger, supplier ledger, and cash-flow.
  - Station filters use journal-line station for ledger reports and finance-event station for party/cash reports.
  - Added `__unassigned__` / `unassigned` filter behavior for null or blank station values.
  - Added a focused station reconciliation test proving station totals add back to the all-station total.
- Frontend:
  - Accounting report filters now include a station field with an `__unassigned__` option.
  - Accounting overview, accounting report pages, and accounting drilldowns pass station through backend requests.
- Known hardening left:
  - Operational finance report pages still need their station filter contract reviewed end-to-end.
  - Mixed-station orders are not yet allocated by item-level revenue/costing; they remain unassigned until source data carries line-level station allocation.
  - Station list is a free-text filter for now; a canonical station picker should be added from configured outlets/printers/stations.

---

## Phase 11: Accounting Permissions and Approval Controls

**Purpose:** Separate cashiers, managers, accountants, and owners.

**Backend files:**

- Modify: `C:\yummy_backend\app\utils\permission_catalog.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Modify: `C:\yummy_backend\app\services\journal_voucher_service.py`
- Modify: `C:\yummy_backend\app\services\opening_balance_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_period_service.py`
- Modify: `C:\yummy_backend\app\services\payment_settlement_service.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_permissions_spec.py`

**Frontend files:**

- Modify: `lib/role-permissions.ts`
- Modify: accounting pages/components to hide disabled actions with clear permission messages.

Permissions:

- `finance.accounting.view`
- `finance.accounting.setup`
- `finance.accounting.opening_balances.manage`
- `finance.accounting.vouchers.create`
- `finance.accounting.vouchers.approve`
- `finance.accounting.vouchers.post`
- `finance.accounting.vouchers.reverse`
- `finance.accounting.periods.close`
- `finance.accounting.periods.lock`
- `finance.accounting.periods.reopen`
- `finance.accounting.settlements.manage`
- `finance.accounting.vat.export`
- `finance.accounting.override_locked_period`

Acceptance:

- A cashier cannot post journals or lock periods.
- A manager can view reports but cannot approve their own voucher if dual-control is enabled.
- Superadmin/owner can override with audit trail.

Better-than-HotelSuite detail:

- Add approval status and actor names directly in voucher/period/settlement screens.

Implementation status - 2026-06-10: implemented permission-gating MVP.

- Backend:
  - Added production accounting permission keys to the canonical permission catalog.
  - Changed the accounting router from generic `finance.income.view` access to `finance.accounting.view`.
  - Added action-specific route permissions for setup repair, opening balances, period close/lock/reopen, voucher create/approve/post/reverse, ledger backfill, VAT export, and settlement reconciliation.
  - Kept manager access report-focused by default instead of granting posting, reversal, lock, export, or settlement action rights.
  - Added backend tests proving the permission catalog contains the production accounting keys and sensitive accounting routes use specific permissions.
- Frontend:
  - Added the same accounting permission keys to the role-permission contract.
  - Changed accounting pages to require `finance.accounting.view`.
  - Added action-specific disabled states and explanatory messages for setup repair, opening balance posting/reversal, voucher lifecycle actions, period actions, VAT export, settlement actions, and ledger backfill.
- Remaining:
  - Add true dual-control enforcement that blocks approving your own voucher when the authenticated actor identity is reliably available in the accounting service layer.
  - Add a persistent approval/override audit trail for owner and superadmin overrides.

---

## Phase 12: Frontend Information Architecture

**Purpose:** Make accounting usable for operators and accountants.

**Frontend structure target:**

- `/finance/accounting`
  - Health/checklist overview
- `/finance/accounting/setup`
  - accounting setup and repair
- `/finance/accounting/opening-balances`
  - opening balance batch
- `/finance/accounting/vouchers`
  - manual journal vouchers
- `/finance/accounting/periods`
  - fiscal periods and locks
- `/finance/accounting/settlements`
  - bank/card/digital/Fonepay settlement
- `/finance/accounting/ar-aging`
  - customer receivable aging
- `/finance/accounting/ap-aging`
  - supplier payable aging
- `/finance/accounting/vat-export`
  - VAT validation/export
- Existing report pages remain:
  - Chart of Accounts
  - Ledger Mapping
  - Trial Balance
  - General Ledger
  - Customer Ledger
  - Supplier Ledger
  - Cash Flow
  - P&L
  - Balance Sheet
  - VAT Summary

Design rules:

- First screen should be a checklist, not a blank ledger report.
- Every report row should have a drilldown action.
- Use precise labels: "Collections", "Sales", "Receivables", "Payables", "Unsettled", "Locked", "Posted", "Reversed".
- Show period and station filters consistently.
- Avoid accounting jargon where a business phrase is clearer, but keep accountant terms in report titles.

Acceptance:

- A non-accountant owner can understand whether accounting is healthy.
- An accountant can find journals, vouchers, periods, ledgers, tax, and settlements quickly.

Implementation status - 2026-06-10: implemented navigation IA MVP.

- Reworked accounting navigation from one long flat link strip into workflow groups:
  - `Start here`: Health, Setup, Opening Balances.
  - `Controls`: Vouchers, Periods.
  - `Ledgers & Reports`: master data, ledgers, aging, cash flow, P&L, and balance sheet.
  - `Tax & Settlement`: Settlements, VAT Summary, VAT Export.
- Added an accessibility label for the accounting navigation region.
- Added frontend contract coverage to prevent the accounting module from regressing back into an ungrouped link strip.
- Remaining:
  - Validate the grouping with a real owner/accountant session after the backend rollout flag and sample data are stable.
  - Consider adding role-aware defaults later, for example owner lands on Health while accountant lands on Vouchers or Trial Balance.

---

## Phase 13: Rollout, Backfill, and Production Safety

**Purpose:** Enable this without corrupting production history.

**Backend files:**

- Modify: `C:\yummy_backend\app\services\accounting_backfill_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_rollout_spec.py`

Tasks:

- [x] Add feature flag `ACCOUNTING_MODULE_V2_ENABLED`.
- [x] Add restaurant-level accounting enablement date.
- [x] Allow backfill dry-run before enablement.
- [x] Require zero trial-balance difference before enablement.
- [x] Require setup complete and mappings complete before enablement.
- [x] Store rollout evidence:
  - backfill run id
  - debit/credit totals
  - suspense amount
  - missing mappings
  - VAT comparison
  - enabled_by
  - enabled_at

Acceptance:

- Production can enable one restaurant at a time.
- Rollout can be audited after the fact.

Implementation status - 2026-06-10: implemented backend rollout MVP.

- Added global feature flag `ACCOUNTING_MODULE_V2_ENABLED`, defaulting to `false`.
- Added separate restaurant-level rollout fields on `accounting_settings`:
  - `accounting_v2_enabled_at`
  - `accounting_v2_enabled_by_id`
  - `accounting_v2_backfill_run_id`
  - `accounting_v2_evidence_json`
- Added migration `20260610_accounting_rollout_enablement.py`.
- Added `AccountingRolloutService`:
  - blocks enablement when the global flag is off.
  - requires setup and default ledger mappings to be complete.
  - requires a completed `commit` accounting backfill run, not only a dry run.
  - blocks enablement when missing mappings, suspense postings, debit/credit mismatch, or Trial Balance difference exist.
  - stores audit evidence on the restaurant accounting settings row.
- Added API routes:
  - `GET /accounting/rollout/status`
  - `POST /accounting/rollout/enable`
- Rollout enablement now calls materialized VAT validation and stores the VAT validation run id, status, totals, difference, row count, and errors in rollout evidence.
- Rollout enablement blocks when materialized VAT validation returns errors.
- Remaining:
  - Add frontend rollout controls after real admin permission/UX review; this action is intentionally backend-first because enabling accounting V2 affects production history.

---

## Required Test Matrix

Backend:

- `.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_spine.py -q`
- `.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_backfill_spec.py -q`
- `.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_extended_reports_spec.py -q`
- `.\venv\Scripts\python.exe -m pytest tests\finance\test_live_accounting_posting_spec.py -q`
- New tests from this plan:
  - `test_accounting_health_spec.py`
  - `test_accounting_setup_spec.py`
  - `test_opening_balances_spec.py`
  - `test_accounting_period_lock_spec.py`
  - `test_journal_vouchers_spec.py`
  - `test_journal_reversals_spec.py`
  - `test_accounting_aging_spec.py`
  - `test_payment_settlement_reconciliation_spec.py`
  - `test_vat_materialized_export_spec.py`
  - `test_accounting_drilldown_spec.py`
  - `test_accounting_station_reports_spec.py`
  - `test_accounting_permissions_spec.py`
  - `test_accounting_rollout_spec.py`

Frontend:

- `npm test -- scripts/__tests__/accounting-ui-contract.test.js`
- `npm test -- scripts/__tests__/finance-reporting-ui-contract.test.js`
- `npm run lint`
- `npm run build`

Manual browser verification:

- Accounting overview health panel.
- Setup repair.
- Opening balance draft/post/reverse.
- Manual voucher draft/submit/approve/post/reverse.
- Period preflight/soft close/lock/reopen.
- Trial Balance after opening balances and manual voucher.
- P&L and Balance Sheet from ledger lines.
- AR/AP aging with customer/supplier examples.
- Card/Fonepay settlement with variance and fee.
- VAT validation export.
- Drilldown from P&L -> journal -> finance event -> source order.
- Station-filtered reports sum back to all-station totals plus unassigned.

---

## Recommended Execution Order

1. Phase 0: Accounting Health Check.
2. Phase 1: Automatic setup for every restaurant.
3. Phase 2: Opening balances.
4. Phase 3: Fiscal periods and locks.
5. Phase 4 and 5: Manual vouchers and reversals.
6. Phase 6: AR/AP aging.
7. Phase 7: Payment settlement reconciliation.
8. Phase 8: VAT validation/export.
9. Phase 9 and 10: Drilldowns and station-wise reports.
10. Phase 11 and 12: Permissions and final UI structure.
11. Phase 13: Rollout hardening.

Do not start with the UI. The UI becomes trustworthy only after accounting health, setup, balances, periods, and reversals exist.

---

## Non-Negotiable Accounting Rules

- Posted journals are never edited in place.
- Reversals are journals, not deletes.
- Locked periods do not change.
- Every report must reconcile to journal lines or explicitly say it is operational-only.
- Suspense account usage is visible and treated as an exception.
- Station filtering must never make totals disappear.
- VAT export must not generate when VAT Summary and Sales Book disagree.
- A restaurant cannot be marked accounting-ready without setup, mappings, backfill, and balanced trial balance.
