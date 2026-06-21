# Payment Instruments V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restaurant-managed card/digital/Fonepay payment instruments so checkout, settlement, daybook, and accounting can distinguish the actual terminal/QR/wallet account.

**Architecture:** Introduce a backend `payment_instruments` master-data table and service. Existing payment and finance-event instrument fields remain the transaction snapshot. Checkout and settlement validation will resolve those snapshots against active instruments without rewriting historical transactions. Next.js accounting setup exposes a minimal instrument management surface.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, pytest, Next.js App Router, TypeScript, Tailwind.

---

## Task 1: Backend Master Data

- Add `PaymentInstrument` model and migration.
- Add schemas for create/update/read.
- Add service methods: list, create, update, resolve.
- Add controller routes under `/accounting/payment-instruments`.

## Task 2: Checkout And Settlement Enforcement

- Validate card/digital/fonepay payment instruments against active master data.
- Allow cash and credit without payment instrument.
- Require settlement preview/create to use an active instrument for non-cash methods.

## Task 3: Accounting Visibility

- Add daybook warnings for non-cash finance events missing instrument.
- Keep posted history immutable; validation only affects new postings and new settlement batches.

## Task 4: Next.js Setup Surface

- Add endpoint helpers and TypeScript types.
- Add an instrument setup card on accounting setup.
- Add contract tests for the API/UI surface.

## Verification

Backend:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_payment_instruments_v2_spec.py tests\finance\test_payment_settlement_reconciliation_spec.py tests\finance\test_accounting_daybook_spec.py -q --tb=short --disable-warnings
```

Web:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit
npm run lint
```
