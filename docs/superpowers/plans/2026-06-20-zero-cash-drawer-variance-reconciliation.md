# Zero-Cash Drawer Variance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an authorized manager or admin to reconcile a drawer whose counted closing cash is zero while preserving the shortage reason, permission check, settlement evidence, and audit trail.

**Architecture:** Keep the backend settlement model unchanged and represent a zero-cash disposition with `settlement_mode="retain_all"`, `retained_float=0`, and `settlement_amount=0`. Make the Next.js dialog derive that default from the counted amount, present it as `No cash to settle`, prevent impossible transfer choices, and surface backend validation details.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Next.js, React, TypeScript, existing API client and Sonner toast utilities.

---

### Task 1: Protect the zero-cash approval contract

**Files:**
- Modify: `C:\yummy_backend\tests\finance\test_drawer_settlement_decision_spec.py`
- Verify: `C:\yummy_backend\app\services\drawer_session_service.py`

- [ ] **Step 1: Write the regression test**

Add a test that closes a drawer with expected cash above zero and counted cash equal to zero, then approves it with `retain_all`, zero retained float, and zero settlement amount. Assert `status == approved`, the negative variance is preserved, and the approval metadata records the zero-cash disposition.

- [ ] **Step 2: Run the focused test before UI changes**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_drawer_settlement_decision_spec.py -q --tb=short --disable-warnings
```

Expected: the new test passes if the existing backend contract already supports the valid zero-cash representation. Any failure identifies a backend validation gap that must be fixed before the web change.

### Task 2: Make zero-cash reconciliation valid by default

**Files:**
- Modify: `components/day-close/drawer-count-dialog.tsx`
- Modify: `scripts/__tests__/day-close-control-ui-contract.test.js`

- [ ] **Step 1: Extend the web contract test**

Require the dialog source to contain `No cash to settle`, a zero-count settlement branch, and backend API error-detail extraction.

- [ ] **Step 2: Run the contract test and confirm failure**

Run:

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
```

Expected: FAIL because the zero-cash label and error-detail handling are not implemented yet.

- [ ] **Step 3: Implement the minimal dialog behavior**

When the persisted counted closing cash is zero, initialize the settlement mode to `retain_all`, retained float to `0`, and settlement amount to `0`. Render `No cash to settle` instead of `Retain all` for this case and disable transfer/deposit modes because they require positive physical cash. Keep the existing `day_close.drawer.approve` gate for `variance_review_required` sessions.

- [ ] **Step 4: Surface backend validation details**

In the settlement catch path, extract `response.data.detail` when available and show it in the toast. Fall back to `Failed to approve drawer settlement decision` only when no backend detail exists.

- [ ] **Step 5: Run focused web checks**

Run:

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: contract tests pass and TypeScript exits with code 0.

### Task 3: Verify the accounting control surface

**Files:**
- Verify only: backend and web files changed above

- [ ] **Step 1: Run backend drawer and day-close tests**

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py tests\finance\test_drawer_settlement_decision_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

Expected: all selected tests pass.

- [ ] **Step 2: Run web lint**

```powershell
npm run lint
```

Expected: exit code 0; existing warnings may remain, but no new errors are allowed.

- [ ] **Step 3: Check patch integrity**

Run `git diff --check` in both repositories. Expected: no whitespace errors.
