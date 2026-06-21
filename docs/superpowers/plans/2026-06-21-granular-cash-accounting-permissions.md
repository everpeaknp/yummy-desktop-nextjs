# Granular Cash And Accounting Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace coarse drawer and settlement authorization with granular cash-control and accounting permissions, while preserving existing role assignments through explicit compatibility implications.

**Architecture:** Extend the canonical backend permission catalog as the source of truth, add cashier/manager/accountant/accounting-approver/admin presets, and migrate sensitive controller actions to specialized guards. Existing `day_close.drawer.*`, `finance.accounting.setup`, and `finance.accounting.settlements.manage` grants remain compatible through permission implications, so deployed custom roles do not lose access unexpectedly. Next.js consumes the existing `/roles/built-in` endpoint and lets administrators apply a preset before customizing a role.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest, Next.js App Router, TypeScript, Tailwind CSS.

**Status:** Implemented and verified on 2026-06-21. Inventory valuation and COGS remain the next independent phase.

---

### Task 1: Canonical Permission Catalog And Compatibility

**Files:**
- Modify: `C:\yummy_backend\app\utils\permission_catalog.py`
- Modify: `C:\yummy_backend\app\utils\permissions.py`
- Test: `C:\yummy_backend\tests\finance\test_cash_accounting_permission_catalog_spec.py`

- [ ] **Step 1: Write failing catalog tests**

Assert the canonical catalog contains:

```python
EXPECTED = {
    "finance.drawer.open.own",
    "finance.drawer.open.any",
    "finance.drawer.close.own",
    "finance.drawer.close.any",
    "finance.drawer.expense.create",
    "finance.drawer.expense.approve",
    "finance.drawer.transfer.to_safe",
    "finance.cash.transfer.to_bank",
    "finance.bank_deposit.confirm",
    "finance.variance.approve",
    "finance.daybook.view",
    "finance.ledger.view",
    "finance.coa.manage",
    "finance.mapping.manage",
    "finance.accounting.adjust",
}
assert EXPECTED <= CANONICAL_PERMISSION_KEYS
```

Also assert old grants expand to the corresponding new keys and `open.any`/`close.any` imply own access.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_cash_accounting_permission_catalog_spec.py -q --tb=short
```

Expected: failure because the new keys are absent.

- [ ] **Step 3: Add catalog metadata and compatibility implications**

Add each permission as an active `PermissionSeed` with concrete allowed, restricted, frontend, backend, and risk metadata. Add canonical implications so:

```python
"finance.drawer.open.any" -> "finance.drawer.open.own"
"finance.drawer.close.any" -> "finance.drawer.close.own"
"day_close.drawer.open" <-> "finance.drawer.open.own"
"day_close.drawer.count" <-> "finance.drawer.close.own"
"day_close.drawer.approve" -> open.any, close.any, variance.approve, transfer.to_safe
"finance.accounting.setup" -> finance.coa.manage, finance.mapping.manage
"finance.accounting.settlements.manage" -> finance.cash.transfer.to_bank, finance.bank_deposit.confirm
```

Compatibility is runtime-only; historical role rows remain unchanged.

- [ ] **Step 4: Run catalog and canonical RBAC tests**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_cash_accounting_permission_catalog_spec.py tests\test_rbac_canonical.py -q --tb=short
```

Expected: pass.

### Task 2: Default Role Presets

**Files:**
- Modify: `C:\yummy_backend\app\utils\permission_catalog.py`
- Test: `C:\yummy_backend\tests\finance\test_cash_accounting_permission_catalog_spec.py`

- [ ] **Step 1: Add failing preset assertions**

Assert:

```python
assert "finance.drawer.open.own" in BUILT_IN_ROLE_PERMISSION_KEYS["cashier"]
assert "finance.drawer.open.any" in BUILT_IN_ROLE_PERMISSION_KEYS["manager"]
assert "accountant" in BUILT_IN_ROLE_PERMISSION_KEYS
assert "accounting_approver" in BUILT_IN_ROLE_PERMISSION_KEYS
assert "finance.accounting.adjust" not in BUILT_IN_ROLE_PERMISSION_KEYS["accountant"]
assert "finance.accounting.adjust" in BUILT_IN_ROLE_PERMISSION_KEYS["accounting_approver"]
```

- [ ] **Step 2: Define least-privilege presets**

Use these boundaries:

```text
cashier: own drawer open/close and drawer-expense create
manager: any drawer open/close, variance approval, drawer-to-safe, daybook
accountant: daybook, ledger, COA, mappings, settlements, VAT and reports
accounting_approver: accountant plus adjustments, vouchers, period controls and bank confirmation
admin: all canonical permissions
```

Do not grant `finance.accounting.adjust`, voucher approval/posting, period lock/reopen, or bank confirmation to cashier or manager.

- [ ] **Step 3: Run preset tests**

Run the focused test from Task 1. Expected: pass.

### Task 3: Backend Action Guards And Own/Any Scope

**Files:**
- Modify: `C:\yummy_backend\app\controller\drawer_session_controller.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_cash_accounting_permissions_spec.py`

- [ ] **Step 1: Write failing route/ownership tests**

Cover these rules:

```text
own permission can operate only the actor's drawer
any permission can operate another cashier's drawer
variance approval requires finance.variance.approve
drawer-to-safe settlement requires finance.drawer.transfer.to_safe
safe-to-bank creation requires finance.cash.transfer.to_bank
bank confirmation requires finance.bank_deposit.confirm
payment instrument management remains finance.accounting.settlements.manage
```

- [ ] **Step 2: Add a drawer scope helper**

Implement a controller helper that checks `session.cashier_id` against the actor and accepts either the own permission for matching sessions or the any permission for all sessions. Admin/superadmin behavior continues through `_has_permission`.

- [ ] **Step 3: Apply specialized guards**

Apply ownership checks to opening, expected breakdown, closing count, recount, movement, and active-drawer visibility. Keep service-level restaurant scope checks. Settlement decisions perform an additional mode check: safe transfer requires `finance.drawer.transfer.to_safe`; bank modes require `finance.cash.transfer.to_bank`; variance requires `finance.variance.approve`.

- [ ] **Step 4: Split cash-transfer and bank-confirmation guards**

Guard transfer creation with `finance.cash.transfer.to_bank`. Guard confirmation/posting actions that recognize bank receipt with `finance.bank_deposit.confirm`. Do not use settlement management as a blanket substitute.

- [ ] **Step 5: Run backend permission tests**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_cash_accounting_permissions_spec.py tests\finance\test_accounting_permissions_spec.py tests\finance\test_drawer_settlement_decision_spec.py -q --tb=short --disable-warnings
```

Expected: pass.

### Task 4: Next.js Permission Keys And Role Presets

**Files:**
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\role-permissions.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\app\(dashboard)\manage\roles\page.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\accounting-ui-contract.test.js`

- [ ] **Step 1: Add failing UI contract assertions**

Assert the permission type includes the new keys and the role page loads `RoleApis.listBuiltInRoles`, renders `Start from preset`, and provides `Cashier`, `Manager`, `Accountant`, and `Accounting approver` choices.

- [ ] **Step 2: Add canonical TypeScript keys**

Extend `PermissionKey` with all Task 1 keys. Keep legacy drawer keys during the compatibility period.

- [ ] **Step 3: Load and apply presets**

Fetch roles, permission catalog, and built-in presets together. Add a compact preset selector at the top of the create/edit modal. Applying a preset replaces the current permission selection after explicit user action; users can then customize individual permissions before saving.

- [ ] **Step 4: Use readable metadata**

Render `Permission.title` when present, fall back to a formatted key, and show risk level for high/critical actions. Keep the permission list grouped by module and responsive.

- [ ] **Step 5: Run web checks**

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

Expected: contract and type checks pass; lint exits zero apart from existing warnings.

### Task 5: Migrate Cash Drawer UI Guards

**Files:**
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\app\(dashboard)\cash-drawers\page.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\day-close\drawer-count-dialog.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\day-close\drawer-session-panel.tsx`
- Test: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\day-close-control-ui-contract.test.js`

- [ ] **Step 1: Add failing guard assertions**

Assert the cash-drawer workspace checks `finance.cash.transfer.to_bank`, the close dialog checks `finance.drawer.close.own`, and variance actions check `finance.variance.approve`.

- [ ] **Step 2: Replace coarse client guards**

Use new keys for action visibility and disabled states. Backend remains authoritative; the UI only prevents confusing unavailable actions.

- [ ] **Step 3: Run complete focused verification**

Run backend tests from Task 3, then:

```powershell
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

Expected: all focused tests and static checks pass.

## Acceptance Criteria

- New cash-control and accounting permissions exist in the canonical backend catalog.
- Existing deployed drawer/accounting grants continue working through explicit compatibility implications.
- Cashier and manager drawer access enforces own-versus-any scope in the backend.
- Variance, drawer-to-safe, cash-to-bank, and bank-confirmation actions use separate permissions.
- Cashier, manager, accountant, accounting approver, and admin presets are available.
- Next.js role creation can start from a preset and then customize permissions.
- Flutter files remain unchanged.
