# Day Close and Accounting Control Design

## Summary

Yummy will use a controlled bridge between restaurant operations and accounting. Cashiers close physical drawers and the operational business day. Accountants review the resulting evidence, resolve posting exceptions, and approve the day for inclusion in a locked accounting period.

The system must not treat operational confirmation as accounting approval. Accounting configuration failures must not trap restaurant staff at closing time, but unresolved accounting failures must block period locking.

## Objectives

- Control physical cash by drawer, station, cashier, and session.
- Produce an immutable daily evidence packet from operational records.
- Connect every day close to finance events and journal entries.
- Keep accounting corrections auditable through reversals and correction vouchers.
- Prevent weekly or monthly accounting lock until all required days are reviewed.
- Explain every reported number from POS source to journal and accounting report.

## Core Concepts

### Drawer Opening Float

The drawer opening float is physical cash available for change. It is not accounting setup data and must not automatically equal the previous day's total closing cash.

Each drawer session records:

- restaurant, business line, station, drawer, and cashier;
- business date and exact opening/closing timestamps;
- configured standard float;
- system-suggested opening float;
- cashier-counted opening cash;
- opening variance and reason;
- manager approval when required;
- denomination count where enabled.

The suggested opening float follows this priority:

1. Approved retained float from the previous drawer session.
2. Configured standard float for the drawer or station.
3. Zero when neither exists.

The cashier must confirm the physical amount. An override above a configurable tolerance requires a reason and manager approval. Once the first cash transaction occurs, opening cash cannot be edited in place. Corrections require an auditable drawer adjustment.

### Accounting Opening Balances

Accounting opening balances are used only when accounting is enabled, migrated, or restarted from an approved cutover date. They include Cash, Bank, Inventory, Receivables, Payables, Loans, Equity, and settlement accounts.

They are posted through a balanced opening-balance journal batch. They are never recalculated from day closes and never used as the daily drawer float.

### Operational Day Close

Operational day close proves what happened during the restaurant business day. It includes all relevant drawer sessions and non-cash activity within an exact time window.

Confirmation validates:

- no unexplained active orders;
- paid, credit, cancelled, and refunded order settlement states;
- closed or explicitly handed-over drawer sessions;
- collections by payment method and instrument;
- refunds and refund liabilities;
- manual income;
- operating expenses;
- inventory cash outflows;
- receivables and credit collections;
- cash drops, paid-outs, transfers, and drawer adjustments;
- expected cash, counted cash, and variance;
- actor, timestamps, notes, and approvals.

Operational confirmation creates an immutable evidence snapshot and attempts finance-event and journal posting. Accounting exceptions do not prevent operational confirmation. Instead, the close becomes `accounting_review_required`.

### Accounting Daily Review

Accounting review is a separate control performed by an authorized accountant or manager. It verifies:

- all relevant finance events are posted;
- mappings are valid;
- Suspense is zero or explicitly resolved;
- Trial Balance difference is zero;
- drawer variance journals match operational variance;
- payment settlement differences are explained;
- post-close adjustments and reversals are complete;
- source drilldowns are available.

Passing review changes the day to `accounting_reviewed`. It does not lock the day independently of the accounting period.

### Accounting Period Lock

Accounting periods remain the final lock authority. Weekly and monthly operational reports are summaries, not competing accounting locks.

A period can be locked only when:

- every required business day is operationally confirmed;
- every included day is accounting reviewed;
- no relevant finance event is unposted;
- Trial Balance is balanced;
- Suspense is zero;
- required settlement reconciliation is complete or approved outstanding;
- VAT validation passes where applicable;
- no unresolved reopening or correction workflow exists.

## State Model

### Drawer Session

- `draft`
- `opened`
- `closing_count_required`
- `closed`
- `variance_review_required`
- `approved`
- `reopened`

### Operational Day Close

- `pending`
- `operationally_confirmed`
- `accounting_review_required`
- `accounting_reviewed`
- `reopened`
- `cancelled`

`accounting_review_required` is an accounting review state layered on an operationally confirmed close. The restaurant day is still operationally closed.

### Accounting Period

- `open`
- `soft_closed`
- `locked`
- `reopened`

## Cash Formula

Expected drawer closing cash is:

```text
counted opening cash
+ cash collections
+ cash manual income
+ cash received from receivables
+ cash transfers in
- cash refunds
- cash operating expenses
- cash inventory/supplier payments
- cash drops and deposits
- cash transfers out
+/- approved drawer adjustments
= expected closing cash
```

The operational cash variance is:

```text
counted closing cash - expected closing cash
```

The day-close expected cash is the sum of included drawer expected balances plus approved non-drawer cash custody balances. Card, Fonepay, digital wallet, and credit amounts never inflate physical cash expected.

## Journal Rules

Cash variance must be ledger-visible:

- Cash short: Debit Cash Over/Short, Credit Cash.
- Cash over: Debit Cash, Credit Cash Over/Short.

Every variance event uses an idempotent key tied to the drawer session or day close. Retrying confirmation cannot double-post.

Mapping changes affect future postings only. Existing incorrect journals require a correction voucher or reversal and repost.

## Corrections and Reopening

### Post-Close Cash Correction

A confirmed close cannot silently replace actual cash. A correction must:

1. record the old and new count;
2. require a reason and actor;
3. reverse the prior cash-variance journal when one exists;
4. create the corrected variance event and journal;
5. invalidate accounting review;
6. invalidate dependent operational period snapshots;
7. block period lock until reviewed again.

These actions occur atomically. If journal reversal or reposting fails, the operational correction fails.

### Reopening

Reopening is allowed only with authorization and an open accounting period. It must reverse associated variance journals and mark the daily accounting review invalid.

For a locked period, the original close remains unchanged. Corrections are posted in the next open period using a correction voucher with a reference to the original business date and day close.

## Persistent Review Record

Accounting review status must not live only inside snapshot JSON. Add a persistent review record containing:

- day close id;
- review status;
- reviewer and reviewed timestamp;
- finance events posted/skipped;
- journal count;
- Trial Balance difference;
- mapping exception count;
- Suspense amount;
- settlement exception count;
- cash variance event and journal ids;
- blocker details;
- invalidated timestamp and reason;
- source snapshot version/hash.

The immutable operational snapshot remains the historical evidence. The review record represents the current accounting disposition.

## Reporting and UX

### Cashier and Manager Flow

1. Open drawer and count float.
2. Operate normally.
3. Count and close each drawer.
4. Review operational day-close evidence.
5. Confirm the restaurant day.
6. See either `Accounting ready` or `Sent for accounting review`.

Cashier UI must not expose ledger mapping or Suspense configuration as tasks they are expected to fix.

### Accountant Flow

The accounting Day Close Review page shows:

- operational status and accounting review status;
- exact covered window;
- drawer opening, movement, expected, counted, and variance totals;
- sales, collections, credit sales, refunds, expenses, inventory cash outflows, and receivables;
- payment methods and instruments;
- unposted events, journals, Trial Balance difference, Suspense, and settlements;
- adjustments, reopenings, approvals, and audit trail;
- drilldowns to source order/payment/refund/expense, finance event, and journal.

Actions include posting missing events, resolving mappings, opening settlement reconciliation, creating correction vouchers, reversing and reposting in open periods, and approving accounting review.

### Period Reports

Weekly and monthly operational reports remain available but are renamed and described as operational summaries. Accounting period pages show daily review coverage and are the only place where financial periods are soft-closed or locked.

## Permissions and Segregation of Duties

- Cashier: open/count/close assigned drawer.
- Manager: approve float and variance exceptions; confirm operational day.
- Accountant: review daily accounting, mappings, settlements, vouchers, and reports.
- Accounting approver: approve review and lock periods.
- Administrator: configure tolerances, drawers, mappings, and emergency overrides.

Where staffing allows, a user should not approve their own material cash variance or accounting correction. Overrides require a reason and audit entry.

## Failure Handling

- Operational snapshot failure blocks operational confirmation because evidence is incomplete.
- Drawer count or active-order blockers prevent operational confirmation.
- Mapping, Suspense, and settlement issues do not block operational confirmation; they require accounting review.
- Failed variance journal creation marks accounting review required.
- Failed reversal blocks post-close correction or reopening.
- Locked periods reject historical mutation and require later-period correction.

## Migration Strategy

Existing restaurant-level day closes remain valid evidence records.

- Treat old closes as one synthetic drawer session only when a drawer breakdown is unavailable.
- Preserve existing snapshots and journal links.
- Backfill accounting review records from current bridge metadata and live health checks.
- Do not infer historical counted opening float from closing cash when evidence is absent.
- Mark unknown historical opening float explicitly as `not_recorded`.

## Acceptance Criteria

- A cashier can operationally close a clean physical day even when an accounting mapping is missing.
- An accounting period cannot lock while any included day requires review.
- Opening float is explicitly counted and is not automatically copied from total prior closing cash.
- Accounting opening balances remain separate balanced setup journals.
- Post-close cash correction reverses and reposts variance accounting atomically.
- Reopening cannot leave the prior variance journal active.
- Every accounting daily-review number drills down to its source.
- Operational weekly/monthly summaries cannot be mistaken for accounting period locks.

## Explicit Non-Goals

- Do not replace accounting opening-balance batches with drawer balances.
- Do not make every payment terminal a physical cash drawer.
- Do not silently rewrite posted journals after mapping changes.
- Do not require cashiers to resolve accounting configuration.
- Do not remove operational weekly/monthly reports; clarify their authority.
