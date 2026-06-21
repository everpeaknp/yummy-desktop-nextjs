# Ledger Mapping Guided Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ledger mapping creation accountant-safe by replacing raw event/payment text entry with guided choices and clear event explanations.

**Architecture:** Keep the behavior frontend-only for now. Extend the existing event label helper into a small catalog, then reuse it inside `LedgerMappingDialog` for both manual creation and exception-prefilled mapping creation.

**Tech Stack:** Next.js, React, TypeScript, local shadcn-style `Select`, Node contract tests.

---

### Task 1: Event Catalog

**Files:**
- Modify: `lib/accounting-event-labels.ts`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Export a complete event option catalog**

Add backend-known event keys, normalize lookup with `trim().toLowerCase()`, and export `ACCOUNTING_EVENT_OPTIONS`.

- [ ] **Step 2: Add contract coverage**

Assert the catalog includes `credit_sale_created`, `inventory_return_processed`, `ACCOUNTING_EVENT_OPTIONS`, and normalized lookup behavior.

### Task 2: Guided Dialog Controls

**Files:**
- Modify: `components/finance/accounting/ledger-mapping-dialog.tsx`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Replace raw event type input**

Use `Select` with human labels and technical keys. Show a neutral helper when no event is selected.

- [ ] **Step 2: Replace raw payment method input**

Use `Select` with `Any method`, `Cash`, `Card`, `Digital / QR`, and `Fonepay`. Convert the internal `__any__` option back to `null` in the API payload.

- [ ] **Step 3: Protect payment-sensitive events**

Block submit when `Any method` is selected for payment-dependent events such as `collection_received`, `refund_processed`, and supplier/inventory cash movement events.

### Task 3: Verification

**Files:**
- Run only; no code files.

- [ ] **Step 1: Run contract test**

Run `node scripts\__tests__\accounting-ui-contract.test.js`.

- [ ] **Step 2: Run TypeScript check**

Run `npx tsc --noEmit`.

- [ ] **Step 3: Run lint if TypeScript passes**

Run `npm run lint`.
