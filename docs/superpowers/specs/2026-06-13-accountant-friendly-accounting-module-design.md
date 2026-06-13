# Accountant-Friendly Accounting Module Design

## Summary

Improve Yummy's accounting module from a technically correct ledger MVP into a usable accountant workflow. The target is not only a prettier screen. The target is a module where an accountant can understand setup status, review reports, manage chart of accounts, maintain ledger mappings, resolve suspense postings, and explain every number back to source transactions.

The recommended approach is an accountant setup and manual mapping MVP with strong guardrails. Station-level mapping and enterprise approval workflows should be designed for later, not built first.

## Current Context

The backend already supports important accounting primitives:

- Chart of accounts.
- Ledger mappings.
- Journal entries and journal lines.
- Trial balance, general ledger, P&L, balance sheet, VAT summary, customer ledger, supplier ledger, AR/AP aging, cash flow.
- Manual journal vouchers and reversals.
- Accounting periods and locks.
- Mapping exception reporting.
- Accounting health checks.

The UI is functional but still too technical:

- The accounting overview is dominated by trial balance/backfill mechanics.
- Mapping management is mostly a read-only table experience.
- Event names are system names, not accountant-facing explanations.
- Suspense resolution is visible but not guided.
- Filters are repeated and plain across reports.
- Navigation does not clearly separate daily controls, statements, ledgers, and setup.

## Goals

- Make accounting screens understandable for non-technical owners and useful for accountants.
- Add safe manual ledger mapping management.
- Make mapping exceptions actionable instead of only warning banners.
- Make filters consistent, visible, and easy to reset/export.
- Improve accounting overview layout around actual accountant workflows.
- Preserve auditability: mapping changes must not silently rewrite posted journals.
- Keep station as a reporting dimension for now, not a mapping dimension.

## Non-Goals

- Do not build station-level account mapping in the first version.
- Do not allow unrestricted mapping edits without audit and warnings.
- Do not auto-rewrite historical journals when mappings change.
- Do not hide unknown payment methods by mapping them to cash automatically.
- Do not replace the accounting engine; improve the workflow around it.

## Recommended Product Shape

Use a hybrid design:

- Guided setup for normal users and restaurant owners.
- Advanced tables for accountants.
- Exception resolver for suspense postings.
- Better dashboard and filter structure for daily use.

This is better than a raw settings table because event types such as `inventory_cash_outflow` and `supplier_payable_created` are implementation names, not accountant language.

## Accounting Home

The accounting home should answer four questions immediately:

- Is accounting ready?
- Are there unposted events?
- Are any journals in suspense?
- Are the books balanced for the selected period?

Top area:

- Accounting health strip:
  - Setup status.
  - Unposted finance events.
  - Suspense amount.
  - Trial balance difference.
  - Period lock status.
- Primary actions:
  - Post Events.
  - Dry Run Backfill.
  - Resolve Exceptions.
  - Create Voucher.
  - Open Reports.

Main content groups:

- Daily controls:
  - Trial Balance.
  - General Ledger.
  - Cash Flow.
- Financial statements:
  - Profit & Loss.
  - Balance Sheet.
  - VAT Summary.
- Ledgers:
  - Customer Ledger.
  - Supplier Ledger.
  - AR Aging.
  - AP Aging.
- Setup:
  - Chart of Accounts.
  - Ledger Mappings.
  - Opening Balances.
  - Periods.

The trial balance can still appear on the home page, but it should not be the only major content. It should be one part of a broader control dashboard.

## Filter Design

Every accounting report should use a shared filter toolbar:

- Date preset:
  - Today.
  - Yesterday.
  - This Week.
  - This Month.
  - Last Month.
  - Custom.
- Date from and date to.
- Business line.
- Station.
- Report basis, if applicable:
  - Posted journals.
  - Finance events.
  - Both, for reconciliation-only screens.
- Refresh button.
- Reset filters button.
- Export current filter button.

The active filter summary should be visible near every report title:

`2026-06-01 to 2026-06-30 | restaurant | All stations | Posted journals`

Station should be a dropdown where possible. Free-text station filtering is too error-prone for normal users.

## Manual Ledger Mapping

Manual mappings should be editable, but controlled.

Each mapping should show:

- Human label.
- System event type.
- Payment method.
- Business line.
- Debit account.
- Credit account.
- Active status.
- Last changed by.
- Last changed at.
- Notes/description.

Example accountant-facing row:

- Label: Inventory purchase paid.
- System event: `inventory_cash_outflow`.
- Payment method: Cash.
- Debit: Supplier Payables.
- Credit: Cash.
- Meaning: Cash paid to supplier for inventory already recorded as an asset/payable.

Mapping resolution priority for first version:

1. Exact event type + payment method + business line.
2. Event type + payment method.
3. Event type default.
4. Suspense account with a visible exception.

Do not add station-level mapping yet. Station remains a reporting/filter dimension.

## Mapping Exception Resolver

Suspense should become an action queue.

For each exception group, show:

- Event type.
- Payment method.
- Business line.
- Count.
- Suspense amount.
- Sample source transaction.
- Suggested mapping, if the system can infer one.

Actions:

- Create mapping for future postings.
- Open source transaction drilldown.
- Create correction voucher for already-posted journals.
- Reverse and repost, if the period is open and the user has permission.

The UI must be explicit:

- Creating a mapping fixes future postings.
- It does not automatically fix already-posted journals.
- Existing suspense requires correction voucher or reversal/repost.

## Chart of Accounts

The account screen should support:

- Create account.
- Edit account name/type/status.
- Deactivate account when unused.
- Prevent deletion if the account has journal lines.
- Search by code/name.
- Filter by account type.
- Show account usage:
  - Used in mappings.
  - Used in journal lines.
  - Suspense account marker.

The default chart should remain seedable, but the UI should not imply defaults are the only possible setup.

## Permissions and Audit

Minimum permissions:

- `finance.accounting.view`: view accounting reports.
- `finance.accounting.accounts.manage`: manage chart of accounts.
- `finance.accounting.mappings.manage`: manage ledger mappings.
- `finance.accounting.vouchers.manage`: create journal vouchers.
- `finance.accounting.vouchers.approve`: approve vouchers.
- `finance.accounting.vouchers.reverse`: reverse journals.
- `finance.ledger.backfill`: run posting/backfill actions.

Mapping edits should record:

- User id.
- Timestamp.
- Old debit account.
- Old credit account.
- New debit account.
- New credit account.
- Reason/note.

If the current schema cannot store all of this yet, add a mapping audit table before calling the workflow production-ready.

## Reposting and Historical Changes

Mapping changes affect future postings only.

For already-posted journals:

- Open period:
  - Allow reverse and repost workflow.
  - Or create correction voucher.
- Locked period:
  - Do not change original month.
  - Allow correction in a later open period.

This is non-negotiable for accounting trust. Silent rewrites may make the UI look fixed, but they destroy auditability.

## UX Structure

Use four top-level accounting areas:

- Overview.
- Reports.
- Setup.
- Controls.

Overview:

- Health, exceptions, posting state, shortcuts.

Reports:

- Trial Balance.
- General Ledger.
- P&L.
- Balance Sheet.
- Cash Flow.
- VAT.
- Customer Ledger.
- Supplier Ledger.
- AR Aging.
- AP Aging.

Setup:

- Chart of Accounts.
- Ledger Mappings.
- Opening Balances.
- Accounting Periods.

Controls:

- Post Events.
- Backfill.
- Mapping Exceptions.
- Journal Vouchers.
- Reversal Queue.
- Settlement Reconciliation.

This structure is easier to explain than mixing setup, posting, reports, and backfill on one screen.

## Better Than HotelSuite Direction

Yummy can be stronger than HotelSuite by making accounting explainable:

- Every report number should drill down to journal lines and source events.
- Every source event should explain the mapping used.
- Suspense should be an action queue, not a mystery.
- Filters should always show the exact reporting scope.
- Accounting setup should be guided, not hidden behind raw tables.
- Operational finance and accounting should reconcile through the same finance event spine.

HotelSuite-style detailed reports are useful, but Yummy should not copy complexity blindly. Yummy should make the accounting chain traceable from POS action to finance event to journal to report.

## Risks

- Too much customization can produce inconsistent books.
- Mapping edits can confuse users if they expect old reports to change automatically.
- Station-level mapping can multiply setup complexity before there is real demand.
- A beautiful dashboard can hide accounting mistakes if exception handling is weak.

The design reduces these risks by keeping first-version customization restaurant-level, audit logged, and explicit about historical correction.

## Implementation Phases

Phase 1: UI information architecture.

- Rework accounting home layout.
- Add grouped navigation.
- Add shared filter toolbar.
- Improve report titles and active filter summaries.

Phase 2: Manual mapping UI.

- Add mapping create/edit dialog.
- Add account selectors.
- Add human labels/descriptions for finance event types.
- Add validation warnings.

Phase 3: Exception resolver.

- Replace passive mapping banner with actionable exception queue.
- Add create mapping from exception.
- Link to source drilldown.

Phase 4: Audit and correction workflow.

- Add mapping audit records.
- Add correction voucher path for suspense journals.
- Add reverse/repost guidance for open periods.

Phase 5: Polish and accountant usability.

- Add search, grouping, export, and saved filter behavior.
- Add help text only where it explains accounting meaning.
- Add focused tests for mapping behavior, exception resolution, and UI contracts.

## Open Decisions

- Whether mapping edits need approval in the first production version.
- Whether custom account templates are needed for Nepal VAT-heavy restaurants.
- Whether report filters should be saved per user.
- Whether station-level mapping becomes a later paid/advanced feature.
