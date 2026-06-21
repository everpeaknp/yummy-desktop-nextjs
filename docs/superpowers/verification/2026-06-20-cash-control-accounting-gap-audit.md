# Cash Control Accounting Gap Audit - 2026-06-20

Scope: current backend and Next.js implementation against:

- `docs/superpowers/specs/2026-06-19-web-first-cash-control-accounting-design.md`
- `docs/superpowers/plans/2026-06-19-backend-nextjs-cash-control-accounting.md`

Flutter is intentionally out of scope for this audit.

## Executive Finding

The plan is not fully implemented.

The drawer workflow is the deepest implemented area. It now has real backend state, drawer configuration, assignment, open/count/reconcile/settle/reopen flows, expected-cash calculation, cash-payment attachment, and a separate Next.js `/cash-drawers` workspace.

The wider accounting system is only partially implemented. There are useful accounting pieces now, but several are still control/report surfaces rather than a complete accounting chain. The biggest missing piece is that drawer settlement decisions do not yet produce a full cash transfer journal chain from drawer to safe/cash-in-transit/bank.

## Requirement Status

| Area | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Separate cash drawer workspace | Mostly implemented | Next.js `/cash-drawers` exists and is wired for open/count/settle/reopen/review. | UX still needs polish and workflow hardening, but this is no longer only inside checkout/day-close. |
| Drawer configuration and cashier assignment | Mostly implemented | Backend has drawer configurations, active assignments, and active drawer checks. | Permission model is still using old `day_close.drawer.*` names, not the new granular `finance.drawer.*` policy model. |
| Opening float and retained carry-forward | Mostly implemented | Backend suggests opening from configured standard float or previous retained float and enforces retained-float differences. Same-day safe-transfer override was fixed. | Opening flow still needs final UX polish and explicit audit display for retained vs changed amount. |
| Cash checkout uses active drawer | Partial | Backend attaches cash payments to cashier active drawer and creates drawer movement records. | Manager/admin drawer selection for exceptional cases is not fully designed end to end. |
| Expected cash breakdown | Mostly implemented | Drawer service calculates opening, movement totals, expected, counted, and variance. UI now shows expected before reconciliation. | Need harden edge cases around late payments, edited payments, refunds, split payments, and source-key idempotency with broader tests. |
| Drawer variance and reconciliation | Partial | Close/recount/approve/reopen exists. Variance reason and approval exist. | Variance posting is day-close oriented. Drawer-level variance approval is not yet a complete standalone accounting event chain. |
| Drawer settlement decision | Partial | Backend stores `retain_all`, `safe_transfer`, `pending_bank_deposit`, and `immediate_bank_deposit`, validates allocation, and requires bank reference for immediate bank deposit. | Settlement decision currently updates drawer session state. It does not create full accounting journals for drawer-to-safe, drawer-to-cash-in-transit, or bank deposit. |
| Day close drawer blockers | Mostly implemented | Day close blocks if configured drawers are not opened/closed/recounted or cash total mismatches submitted actual cash. | Day close should also become stricter around unapproved drawer settlements and pending transfer/deposit states once transfer journals exist. |
| Day-close accounting review | Partial | Accounting bridge posts missing finance events, records cash variance event, checks unposted events, trial balance, missing mappings, and suspense. | It does not yet validate the full physical-cash settlement chain because that chain is incomplete. |
| Daybook opening/transactions/closing | Partial | Backend daybook service and Next.js daybook tabs exist for cash control, instruments, transfers, ledger impact, exceptions. | Daybook transfer tab depends on drawer movement/control data, not a complete transfer ledger model. It needs settlement journal integration and clearer opening/closing source trace. |
| Cash-to-bank one click | Not complete | UI/backend support immediate bank deposit as a drawer settlement mode. | There is no standalone, one-click cash account/safe to bank transfer workflow with posted journal, cash-in-transit state, deposit reference, and reversal. |
| Drawer-to-cash account transfer | Not complete | Safe transfer can be selected during drawer settlement. | Needs actual finance event and journal posting: Dr Main Cash/Safe, Cr Cashier Drawer Cash, with audit and daybook visibility. |
| Card/digital separation | Partial | Default mappings post card/digital/fonepay collections to clearing accounts. Payment settlement service can post clearing-to-bank batches with fees/variance. | Accounting health still reports payment settlement reconciliation as unknown, and daybook instrument status does not fully reflect settlement batch status. |
| Chart of accounts template | Partial | Default restaurant accounts and default mappings exist. Setup health checks required accounts/mappings. | Customization UX and guardrails are not a full COA wizard. Some requested categories are present as defaults, but not all account/mapping operations are easy or guided enough. |
| Ledger mapping | Partial | Default mappings, suspense fallback, mapping exception resolver, and guided mapping dialog exist. | Mapping creation still requires the user to understand event types unless launched from a specific exception. Need stronger event catalog, explanations, and validation. |
| Cashflow mapping | Not complete | Some cash categorization exists in accounting service/reporting. | There is no detailed configurable cashflow mapping layer equivalent to the requested ledger mapping flexibility. |
| Inventory accounting | Partial by phase-1 plan; incomplete for full vision | Inventory receiving emits asset/payable/cash-outflow finance events. Default mappings include inventory asset, supplier payable, and COGS accounts. | Full consumption flow is not implemented: recipe consumption, COGS recognition from sales, wastage, stock variance, and inventory valuation are still future work. |
| Opening balances | Partial | Setup health detects missing opening balance and opening-balance posting exists in accounting area. | Existing-business balance sheet remains incomplete until users post opening balances. Needs guided opening balance wizard. |
| Permissions | Partial/wrong shape | Web has granular permission keys for accounting and old drawer keys such as `day_close.drawer.open/count/approve/reopen/configure`. | Requested model was per restaurant with optional overrides by business line and role, using new granular drawer/cash permissions. That is not fully implemented. |
| UI/UX | Partial | New drawer/daybook/setup/settlement surfaces exist and use modern components. | The flow still feels fragmented: Cash Drawers, Day Close, Daybook, Settlements, Setup, and Mapping are separate surfaces without one clean accounting workflow path. |
| Verification | Partial | Focused backend and web contract/type/lint checks pass. Previous production build passed; a fresh build was later blocked only by active `next dev`. | Full manual end-to-end web test checklist has not been completed and documented after the latest drawer fixes. |

## Specific Accounting Weakness

The current drawer settlement approval stores this information on the drawer session:

- retained float
- settlement mode
- settlement amount
- settlement destination
- settlement reference
- approval metadata

That is good cash-control evidence, but it is not enough accounting.

For proper accounting, settlement approval should create immutable finance events and posted journals such as:

1. Safe transfer:
   - Dr Main Cash / Safe
   - Cr Cashier Drawer Cash

2. Pending bank deposit:
   - Dr Cash In Transit
   - Cr Main Cash / Safe or Cashier Drawer Cash

3. Immediate bank deposit:
   - Dr Bank
   - Cr Cashier Drawer Cash or Cash In Transit

4. Retained all:
   - no transfer journal, but retained amount must become the next opening source.

Until that exists, the system can show that cash was retained/transferred/deposited operationally, but accounting is not fully proving where physical cash moved.

## What Should Be Implemented Next

### Phase 2A: Physical Cash Transfer Accounting

This is the most important next step.

- Add finance event types for:
  - `drawer_safe_transfer_recorded`
  - `drawer_bank_deposit_pending`
  - `drawer_bank_deposit_posted`
  - `safe_bank_deposit_posted`
  - `drawer_retained_float_confirmed` if an audit-only event is useful
- Add default mappings:
  - Drawer Cash to Main Cash/Safe
  - Drawer Cash to Cash In Transit
  - Main Cash/Safe to Cash In Transit
  - Cash In Transit to Bank
  - Drawer Cash to Bank for immediate deposit
- Post journals at settlement approval time, not only at day close.
- Store journal IDs back on drawer settlement metadata or a dedicated settlement table.
- Make reversal/reopen create audited reversals instead of silent mutation once posted.

### Phase 2B: Daybook V2

- Show opening balance source with trace:
  - configured standard float
  - previous retained float
  - manager-approved override
  - opening balance journal
- Show physical cash transfers from posted journals, not only drawer movement rows.
- Show card/digital settlement batch status:
  - unsettled
  - matched
  - variance approved
  - posted
  - reversed
- Make closing balance reconcile against ledger balances.

### Phase 2C: Accounting Health Hardening

- Replace current unknown checks:
  - VAT export validation
  - payment settlement variance
- Add physical cash transfer checks:
  - approved drawer settlement without transfer journal
  - pending bank deposit past expected deposit date
  - retained float mismatch with next opening
  - unposted drawer transfer event

### Phase 2D: Permissions

Move from old drawer permissions to explicit cash-control permissions:

- `finance.drawer.open.own`
- `finance.drawer.open.any`
- `finance.drawer.count.own`
- `finance.drawer.count.any`
- `finance.drawer.approve_variance`
- `finance.drawer.reopen`
- `finance.drawer.configure`
- `finance.cash.transfer.to_safe`
- `finance.cash.transfer.to_bank`
- `finance.cash.deposit.confirm`

Then seed default role presets and allow restaurant/business-line overrides.

### Phase 2E: Inventory Consumption Accounting

This should be its own phase after cash control is stable.

- Keep purchases as Inventory Asset / Supplier Payable or Cash/Bank.
- Add consumption events from recipe/order production.
- Post COGS when inventory is consumed, not when stock is purchased.
- Add wastage and variance flows with approval.
- Add stock valuation method policy.

## Bottom Line

The current work is valuable, but it is not the full refactor yet.

Your suspicion is mostly correct: drawer has been implemented far more deeply than the rest. Accounting setup, daybook, mapping, settlements, and inventory have real scaffolding and some working behavior, but they are not yet one complete accounting-grade flow.

The next implementation should not spread across every area at once. The correct next move is to finish the physical cash accounting chain first, because everything else depends on it:

Drawer close -> settlement decision -> finance event -> journal -> daybook -> day close review -> reversal/reopen audit.
