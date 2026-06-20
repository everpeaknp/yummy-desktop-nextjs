# Web-First Cash Control Accounting Design

## Summary

Yummy will implement phase 1 of the drawer, daybook, and accounting refactor in the backend and Next.js web app only. The backend must own the accounting engine, posting rules, drawer state, policies, and audit trail. The web app is the control surface for account setup, drawer policy, mapping health, daybook review, settlement review, and manager or accountant approvals. Flutter must wait until the backend and web implementation has been tested end to end.

This phase is the cash-control accounting spine. It is not a full inventory accounting rollout and not a Flutter implementation phase.

## Goals

- Build a reliable cashier shift drawer model for physical cash control.
- Connect drawer movements, cash payments, transfers, and variances to accounting journals immediately.
- Provide a layered daybook with operational cash control and accountant drilldown.
- Seed a standard restaurant chart of accounts and allow safe customization.
- Make ledger mapping health visible, flexible, and auditable.
- Route non-blocking unmapped events to Suspense instead of silently dropping accounting.
- Keep confirmed drawer sessions, day closes, and journals auditable through reversals and adjustments.
- Prepare the accounting model for future inventory valuation and COGS without implementing that phase now.

## UI And UX Principles

The backend and Next.js implementation must be clean, minimal, responsive, modern, and easy to use. This is not cosmetic polish after the accounting work; it is part of the accounting design because confusing finance UI causes wrong operational decisions.

Design principles:

- Use calm, dense, scan-friendly operational layouts instead of marketing-style pages.
- Prioritize one clear primary action per screen or panel.
- Keep setup workflows guided, but keep accountant review screens information-dense.
- Use progressive disclosure: show the daily answer first, then drill into journals, events, and source records.
- Use tabs for daybook layers instead of one oversized report table.
- Use stepper or checklist patterns for setup and drawer close flows.
- Use compact cards only for summaries and repeated records; avoid nested card layouts.
- Use clear empty, loading, blocked, warning, and success states.
- Keep mobile and tablet layouts usable, especially for managers reviewing drawers away from a desktop.
- Preserve keyboard-friendly tables and filters for accountant-heavy screens.
- Avoid jargon where the user is operational, but keep accounting terms precise where the user is an accountant.

Required UX shape:

- Setup: wizard-style flow for COA seed, core mappings, drawer policies, and bank or clearing accounts.
- Daybook: tabbed workspace with sticky date/business-line filters and visible opening/closing balances.
- Drawer close: short guided review with count, variance, settlement decision, and approval state.
- Exceptions: action queue, not a passive warning banner.
- Drilldown: every important amount can open source transaction, finance event, journal entry, and account impact.

Responsive behavior:

- Desktop: two-column or split-panel review where summary, table, and drilldown can be seen together.
- Tablet: stacked sections with sticky actions.
- Mobile: single-column workflows with concise summaries and bottom actions; large tables collapse into grouped rows.

The UI must not hide accounting exceptions to look clean. Minimal means fewer distractions, not fewer controls.

## Non-Goals

- Do not implement any Flutter runtime changes in phase 1.
- Do not let Flutter calculate ledger truth.
- Do not add temporary Flutter drawer behavior before the backend and web flows are validated.
- Do not implement full inventory valuation, recipe consumption, COGS, wastage, or stock variance posting in phase 1.
- Do not treat card or digital payments as direct bank deposits at sale time.
- Do not silently rewrite historical journals when account mappings change.
- Do not allow day close with open cashier drawers.

## System Boundary

The backend owns accounting truth:

- chart of accounts;
- account mappings;
- finance events;
- double-entry journal posting;
- Suspense routing;
- drawer balances;
- daybook snapshots;
- bank deposit state;
- day-close blockers;
- accounting review state;
- reversals, adjustments, and audit history.

The Next.js web app owns the admin and accounting workflows:

- standard restaurant chart of accounts setup wizard;
- mapping health and exception resolver;
- cashier drawer configuration and policies;
- layered daybook review;
- drawer close review and settlement decisions;
- immediate or pending cash-to-bank transfer flow;
- permissions and role preset management;
- accounting review before period lock.

Flutter is explicitly out of scope for phase 1. It comes later as the POS/runtime client only after backend and web validation:

- cash payment uses the logged-in cashier's active drawer;
- manager and admin roles can select from active drawers where permitted;
- cashier-facing open, count, and close flows can be added after the backend and web contracts are stable;
- Flutter displays backend balances and does not own ledger calculations.

Phase 1 completion requires backend and Next.js testing of the full accounting flow before Flutter work begins.

## Core Entities

Phase 1 should introduce or complete these concepts:

- `ChartAccount`
- `AccountMapping`
- `CashierDrawerSession`
- `DrawerPolicy`
- `FinanceEvent`
- `JournalEntry`
- `JournalLine`
- `DaybookSnapshot`
- `BankDeposit`
- `AccountingException`

Existing accounting objects in the web app should be reused where possible. New UI should fit under the existing `/finance/accounting` and day-close control areas instead of creating a parallel finance module.

## Drawer Lifecycle

A cashier shift drawer is the unit of cash accountability.

Manager assignment:

- A manager can create or assign a drawer session to a cashier.
- The assigned cashier must accept and open it by entering the counted opening float.
- Manager-created assignment must remain visible in audit history.

Opening:

- The system suggests an opening float from policy, retained float, or prior settlement where available.
- The cashier enters the actual counted amount.
- If the count exceeds policy tolerance, manager approval is required.
- Once cash movement starts, opening cash cannot be edited directly; corrections require an adjustment.
- When the prior approved drawer settlement retained cash, that retained amount is the authoritative opening carry-forward for the next session. Flexible-opening policy must not replace it with an unrelated manual baseline.
- Opening carry-forward must use the latest approved session for the drawer on or before the requested business date. This includes an approved session closed earlier on the same business date, so a close, settlement, and reopen cycle cannot fall back to an older retained amount.
- A safe or bank transfer with zero retained cash is also authoritative. The next opening suggestion is zero, not the retained amount from an older session.
- The next cashier confirms custody by opening with the carried amount; the web form displays it as locked and labels its source as previous retained float.
- If the physical amount differs from retained cash, only a user with drawer approval permission may enter the actual amount with a mandatory reason. Backend validation must enforce this even if a stale or modified client submits another amount.
- When no retained cash exists, normal configured or flexible opening behavior remains available.

Runtime cash payments:

- A normal cashier's cash payment posts into that cashier's accepted active drawer automatically.
- Normal cashiers cannot freely select other drawers.
- Manager and admin roles may select another active drawer when permission allows.
- If no active drawer is available for a cashier, cash payment must be blocked or require an explicit manager override.

Closing:

- The cashier counts closing cash.
- The system shows opening float, cash sales, cash credit collections, refunds, drawer expenses, drops, transfers, expected cash, counted cash, and variance.
- The close flow requires a settlement decision:
  - retain a configured float for the next drawer;
  - transfer excess to main cash or safe;
  - start a pending bank deposit;
  - post an immediate bank deposit for trusted roles;
  - record and approve variance where required.
- When counted closing cash is zero, a shortage can still be reconciled. The approver records the variance reason and approves a zero-cash disposition; the system must not require a safe transfer or bank deposit when no physical cash exists.
- Zero-cash reconciliation remains permission-gated by drawer variance approval and must create the same approval audit evidence as other variances.
- The web flow should label this disposition as `No cash to settle`; the existing backend `retain_all` representation may be reused with both retained and settlement amounts set to zero.
- Backend validation errors must be shown to the operator so a rejected settlement explains the exact invalid field or rule.
- A drawer in `variance_review_required` may be corrected before approval through an audited recount. The original closing count remains immutable evidence; the corrected amount is stored as a new `recount` record with a mandatory correction reason.
- Recount recalculates expected cash, counted cash, variance, and the next status. A corrected count within tolerance returns to `closed`; an out-of-tolerance count remains `variance_review_required`.
- Recount clears any unapproved settlement allocation fields so settlement is always rebuilt from the corrected physical count.
- Once a drawer is `approved`, count correction is not available. The existing permission-gated audited reopen flow must be used instead.

Confirmed drawer sessions are immutable. Corrections use adjustments, reversals, or audited reopening depending on period state.

## Day Close Rules

Day close is a reconciliation and lock process, not the place where normal accounting is created.

Required behavior:

- Payment, transfer, drawer expense, and variance journals post immediately when the source event happens.
- Day close validates that every cashier drawer for the business day is closed.
- Day close blocks on open drawers.
- Day close blocks on missing core mappings, failed journal posting, invalid drawer settlement, or over-threshold variance without approval.
- Day close can proceed with non-blocking accounting exceptions if they are clearly shown in the confirmed close.

Blocking exceptions:

- open cashier drawers;
- missing core accounts or mappings;
- failed journal posting;
- invalid drawer settlement;
- over-threshold variance without approval.

Non-blocking exceptions:

- card or digital instrument posted to Suspense;
- optional drawer expense category unmapped;
- pending bank deposit;
- unsettled card or digital clearing balance.

Confirmed day closes are immutable. Historical corrections require reversal or correction vouchers. Locked periods cannot be mutated directly.

## Layered Daybook

The daybook should not be a single overloaded table. It should be layered so managers can control cash quickly and accountants can drill into journals.

Tabs:

- Cash Control: opening cash, cash sales, refunds, drawer expenses, drops, safe transfers, bank deposit starts, closing cash.
- Payment Instruments: card terminals, QR instruments, wallets, expected settlement account, actual settlement status.
- Transfers: drawer-to-safe, safe-to-bank, bank confirmations, bank-to-bank where supported.
- Ledger Impact: finance events and generated journal entries for the selected day.
- Exceptions: Suspense, missing mappings, variance approval, failed postings, pending settlement issues.

Every daybook total should drill down to source transaction, finance event, and journal line where available.

## Chart Of Accounts

Phase 1 should provide a standard restaurant chart of accounts template, then allow safe customization. Users should not start from a blank chart because most restaurant staff are not accountants.

Minimum template accounts:

- Cashier Drawers
- Main Cash / Safe
- Cash In Transit
- Bank Accounts
- Card Clearing
- Digital Wallet / QR Clearing
- Sales Revenue
- VAT / Tax Payable
- Refunds / Returns
- Cash Over Short
- Suspense
- Basic Drawer Expense Categories
- Inventory Asset
- Supplier Payable
- COGS
- Wastage Expense
- Inventory Variance

Account rules:

- Users can rename accounts where safe.
- Users can add custom accounts.
- Users can deactivate accounts.
- Users cannot delete accounts with journal history.
- Suspense must remain visible.
- Required mapping health must be visible from setup and daybook screens.

## Mapping Health

Mapping health uses mixed strictness.

Blocking core mappings:

- cashier drawer cash;
- main cash or safe;
- bank;
- sales revenue;
- tax payable;
- refunds or returns;
- cash variance;
- Suspense.

Non-blocking mappings:

- new card terminal;
- new QR or wallet instrument;
- drawer expense category;
- custom account route.

If a non-blocking mapping is missing, the backend posts to Suspense and creates an accounting exception. Creating a new mapping fixes future postings only. Existing Suspense journals require a correction voucher or reversal and repost where period state allows.

## Posting Rules

Journals should be created immediately per transaction.

Examples:

```text
Cash sale:
Dr Cashier Drawer
Cr Sales Revenue
Cr Tax Payable

Card sale:
Dr Card Clearing - Terminal X
Cr Sales Revenue
Cr Tax Payable

Digital sale:
Dr Digital Clearing - Instrument X
Cr Sales Revenue
Cr Tax Payable

Drawer-to-safe transfer:
Dr Main Cash / Safe
Cr Cashier Drawer

Pending bank deposit:
Dr Cash In Transit
Cr Main Cash / Safe

Confirmed bank deposit:
Dr Bank
Cr Cash In Transit

Immediate bank deposit:
Dr Bank
Cr Main Cash / Safe

Cash short:
Dr Cash Over Short
Cr Cashier Drawer or Main Cash

Cash over:
Dr Cashier Drawer or Main Cash
Cr Cash Over Short
```

Card and digital payments must post first to clearing accounts. Settlement to bank posts later when the settlement is confirmed, including fees and variances.

## Cash-To-Bank Transfer

The web app should support both immediate and pending cash-to-bank flows.

Immediate mode for trusted roles:

```text
Dr Bank
Cr Main Cash / Safe
```

Default pending mode:

```text
Start deposit:
Dr Cash In Transit
Cr Main Cash / Safe

Confirm deposit:
Dr Bank
Cr Cash In Transit
```

Deposit short, fee, or variance requires an adjustment reason and approval. The UI label can still be simple, but the accounting state must distinguish cash leaving the safe from money confirmed by the bank.

## Drawer Policy

Drawer behavior is policy-driven.

Policy resolution order:

1. restaurant default;
2. business-line override;
3. role override;
4. explicit manager approval override.

Policy controls:

- whether drawer expenses are allowed;
- allowed drawer expense categories;
- max amount per transaction;
- max total per drawer or day;
- whether manager approval is required;
- variance tolerance;
- opening float tolerance;
- retainable float rules;
- permitted transfer destinations;
- ledger and cashflow mapping requirements.

Overrides must be visible in the UI so managers understand why an action is allowed, blocked, or approval-gated.

## Permissions

Use granular permissions with default role presets.

Suggested permissions:

- `finance.drawer.open.own`
- `finance.drawer.open.any`
- `finance.drawer.close.own`
- `finance.drawer.close.any`
- `finance.drawer.expense.create`
- `finance.drawer.expense.approve`
- `finance.drawer.transfer.to_safe`
- `finance.cash.transfer.to_bank`
- `finance.bank_deposit.confirm`
- `finance.variance.approve`
- `finance.daybook.view`
- `finance.ledger.view`
- `finance.coa.manage`
- `finance.mapping.manage`
- `finance.accounting.adjust`

Default presets should map these to cashier, manager, accountant, accounting approver, and administrator roles without hardcoding accounting behavior to role names.

## Inventory Boundary

Inventory accounting is designed but not implemented in phase 1.

Phase 1 must stop designing stock purchases as ordinary expenses. The chart and mappings should reserve accounts for Inventory Asset, Supplier Payable, COGS, Wastage Expense, and Inventory Variance.

Future posting rules:

```text
Inventory purchase paid immediately:
Dr Inventory Asset
Cr Cash / Bank

Supplier payable created:
Dr Inventory Asset
Cr Supplier Payable

Supplier payment:
Dr Supplier Payable
Cr Cash / Bank

Recipe consumption:
Dr COGS
Cr Inventory Asset

Wastage or spoilage:
Dr Wastage Expense
Cr Inventory Asset

Stock variance:
Dr/Cr Inventory Variance
Cr/Dr Inventory Asset
```

Phase 1 may show inventory-related accounts and future mapping placeholders, but it should not implement valuation or consumption posting.

## UI Placement

Backend and Next.js phase 1 screens should extend existing accounting and day-close areas.

Recommended placement:

- `/finance/accounting/setup`: COA template setup, required mapping health, account health.
- `/finance/accounting/chart-of-accounts`: account creation, edit, deactivate, usage visibility.
- `/finance/accounting/ledger-mapping`: mapping management and future-posting rules.
- `/finance/accounting/daybook`: layered daybook tabs.
- `/finance/accounting/settlements`: card, digital, and bank deposit settlement review.
- `/finance/accounting/day-closes`: accounting review of operational closes.
- Day-close operational area: drawer readiness, opening count, close count, settlement decisions where web users operate drawers.

Existing components such as accounting setup, mapping exception resolver, day-close review, settlement reconciliation, and drawer session panels should be reused and extended instead of replaced blindly.

## Current System Transition

The current day close, accounting, and drawer work should not be thrown away. It should be migrated into the new cash-control accounting spine.

Current day close:

- The existing operational day-close pages remain the user entry point while phase 1 is built.
- Existing confirmed day closes remain valid historical evidence.
- Day close changes from "cash summary screen" into "operational close plus accounting review handoff."
- Day close will gain stricter blockers for open drawers and invalid settlement decisions.
- Existing saved snapshots and exports remain readable.
- New closes will include drawer-level evidence and accounting status.
- Old closes without drawer breakdown are shown as historical aggregate closes, not rewritten as fake cashier drawers.

Current accounting:

- Existing accounting routes under `/finance/accounting` remain the home for this work.
- Chart of accounts, ledger mapping, vouchers, settlements, reports, and review screens are extended rather than replaced wholesale.
- Existing journals remain untouched.
- Existing mapping behavior stays forward-only: new mappings affect future postings.
- Existing Suspense journals remain visible and are corrected through vouchers or reversal/repost where allowed.
- Accounting setup becomes more guided and stricter about core mappings, but it should not break historical reports.

Current drawers:

- Existing drawer configuration and drawer session components become the foundation for cashier shift drawers.
- Current restaurant or station drawer concepts are migrated toward cashier accountability.
- Drawer settings move from simple configuration to policy-driven cash control.
- Open/close drawer flows gain settlement decisions, variance approval, and journal impact.
- Existing drawer records remain auditable; missing old opening-float evidence is marked as not recorded.

Current payment instruments:

- Existing card, QR, Fonepay, and digital payment configuration becomes settlement instrument setup.
- Payment method labels remain operational labels.
- Accounting maps the actual instrument to clearing accounts.
- Unmapped instruments post to Suspense and appear in the exception queue.

Current inventory and purchases:

- Existing inventory and purchase screens keep working operationally.
- Phase 1 does not implement full inventory valuation or COGS.
- The accounting setup reserves proper accounts so future inventory work does not keep treating stock purchases as normal expenses.

## Migration

Existing restaurant-level day closes remain valid evidence.

Migration rules:

- Treat old closes as synthetic aggregate drawer sessions only when no drawer breakdown exists.
- Preserve existing snapshots and journal links.
- Do not infer historical opening float from prior closing cash when evidence is absent.
- Mark historical opening float as `not_recorded` when unavailable.
- Mapping changes remain forward-only.
- Historical Suspense is corrected through vouchers or reversal/repost, not silent journal rewrites.

## Acceptance Criteria

- Web users can seed a standard restaurant chart of accounts and customize it safely.
- Setup health clearly separates blocking core mappings from non-blocking mappings.
- A cashier shift drawer has opening count, movement summary, closing count, settlement decision, and audit trail.
- Cash payments require an active cashier drawer and post immediately to that drawer.
- Day close is blocked while any drawer for that business day is open.
- Day close can proceed with non-blocking Suspense exceptions but shows them clearly.
- Card and digital sales post to clearing accounts, not directly to bank.
- Cash-to-bank supports immediate and pending deposit modes.
- Confirmed drawers, day closes, and journals are immutable except through audited reversal, correction, or reopening workflows.
- The layered daybook shows opening balance, transactions, transfers, ledger impact, exceptions, and closing balance.
- Inventory accounts and future posting rules are represented without implementing full inventory valuation in phase 1.
- The Next.js UI is minimal, responsive, modern, scan-friendly, and usable on desktop, tablet, and mobile.
- Existing day close, accounting, drawer, payment instrument, and inventory records remain accessible during and after migration.

## Risks

- A full COA wizard can delay cash-control delivery if it tries to solve every future accounting category at once.
- Too much mapping flexibility can create inconsistent books unless defaults and required mappings are clear.
- Allowing drawer expenses without policy limits can weaken cash accountability.
- Posting only at day close would make reports stale and concentrate errors; phase 1 avoids this by immediate posting.
- Direct-to-bank card or digital posting would hide settlement failures and fees; clearing accounts are mandatory.

## Implementation Direction

Use the cash-control spine approach:

1. Fully implement backend contracts and accounting behavior for drawer sessions, policies, COA template, mappings, journals, daybook, bank deposits, exceptions, and audit flows.
2. Fully implement the Next.js setup and control surfaces for those backend capabilities.
3. Test the complete flow in the web app: COA setup, mappings, drawer open/close, cash posting, daybook, transfers, deposits, exceptions, day close, and journal drilldown.
4. Only after backend and Next.js pass this validation should Flutter runtime changes be planned.
