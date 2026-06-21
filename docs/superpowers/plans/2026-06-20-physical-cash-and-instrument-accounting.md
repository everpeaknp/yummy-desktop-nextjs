# Physical Cash And Instrument Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the missing backend and Next.js accounting spine for drawer-to-safe, safe-to-bank, cash-in-transit, and instrument-aware card/digital settlement.

**Architecture:** Use existing finance events and posted journals as the accounting source of truth. Drawer settlement decisions will create idempotent finance events and journals immediately. Non-cash payment instruments continue to settle through payment settlement batches, but daybook and health must expose instrument status instead of hiding it behind generic card/digital totals.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, pytest, Next.js App Router, TypeScript, Tailwind.

---

## Scope

This plan implements the accounting-grade phase that was missing from the first cash-control plan:

- Drawer to safe transfer journals.
- Drawer or safe to cash-in-transit journals.
- Cash-in-transit or drawer to bank deposit journals.
- Retain-all audit behavior without transfer journal.
- Daybook visibility for physical cash transfer journals.
- Accounting health checks for approved drawer settlements without journals.
- Instrument-aware card/digital settlement visibility.

This plan does not implement full inventory consumption accounting. That remains a separate phase because it needs recipe consumption, stock valuation policy, wastage, and variance approval.

## Task 1: Backend Physical Cash Transfer Posting

**Files:**

- Modify: `C:\yummy_backend\app\models\finance_event_model.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\services\drawer_session_service.py`
- Test: `C:\yummy_backend\tests\finance\test_drawer_settlement_decision_spec.py`

- [ ] Add finance event types for drawer safe transfer, pending bank deposit, immediate bank deposit, and safe bank deposit.
- [ ] Add default accounts for Cashier Drawer Cash, Main Cash/Safe, Cash In Transit, and Bank if they are not explicit enough.
- [ ] Add default ledger mappings:
  - `drawer_safe_transfer_recorded`: Dr Main Cash/Safe, Cr Cashier Drawer Cash
  - `drawer_bank_deposit_pending`: Dr Cash In Transit, Cr Cashier Drawer Cash
  - `drawer_bank_deposit_posted`: Dr Bank, Cr Cashier Drawer Cash
  - `safe_bank_deposit_pending`: Dr Cash In Transit, Cr Main Cash/Safe
  - `safe_bank_deposit_posted`: Dr Bank, Cr Cash In Transit
- [ ] In drawer settlement approval, create a finance event with a stable event key and post it immediately.
- [ ] Store the finance event and journal trace in drawer approval metadata.
- [ ] Keep `retain_all` audit-only; it should not create a transfer journal.

## Task 2: Daybook And Health Visibility

**Files:**

- Modify: `C:\yummy_backend\app\services\accounting_daybook_service.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_daybook_spec.py`

- [ ] Include posted physical cash transfer events in the daybook transfer tab.
- [ ] Show source, destination, settlement reference, drawer session id, and journal id when available.
- [ ] Add a health warning/blocker for approved drawer settlements missing a transfer journal.
- [ ] Keep retained-all sessions out of transfer warnings.

## Task 3: Instrument Settlement Visibility

**Files:**

- Modify: `C:\yummy_backend\app\services\accounting_daybook_service.py`
- Modify: `C:\yummy_backend\app\services\payment_settlement_service.py`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\daybook-client.tsx`
- Test: `C:\yummy_backend\tests\finance\test_accounting_daybook_spec.py`
- Test: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\accounting-ui-contract.test.js`

- [ ] Group payment instruments by `payment_method + instrument_name`.
- [ ] Pull settlement batch status into daybook rows when a matching batch exists.
- [ ] Show card/digital/fonepay as clearing balances until settlement is posted.
- [ ] Make UI labels explain the actual instrument, not only the payment method.

## Task 4: Next.js Cash Transfer Surface

**Files:**

- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\app\(dashboard)\cash-drawers\page.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\day-close.ts`
- Test: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\day-close-control-ui-contract.test.js`

- [ ] Keep drawer close settlement in `/cash-drawers`.
- [ ] Add clear copy and controls for safe transfer, pending bank deposit, immediate bank deposit, and retain all.
- [ ] Add a separate safe-to-bank action once the backend endpoint exists.
- [ ] Require deposit reference for immediate bank deposit.
- [ ] Show posted journal trace after settlement approval.

## Task 5: Verification

Run:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_daybook_spec.py tests\finance\test_drawer_settlement_decision_spec.py tests\finance\test_accounting_setup_core_mapping_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

## Self-Review

- Physical cash transfer accounting is now explicitly separated from drawer evidence.
- Card/digital/fonepay instrument settlement remains separate from physical cash transfer.
- Inventory consumption is excluded intentionally and must get its own implementation plan.
