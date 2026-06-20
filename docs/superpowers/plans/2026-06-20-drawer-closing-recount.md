# Drawer Closing Recount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users correct an erroneous drawer closing count before variance approval without deleting or rewriting the original count evidence.

**Architecture:** Extend the existing closing-count command to accept `variance_review_required` as an audited recount state. The backend appends a `DrawerCountType.recount` row, requires a correction reason, recalculates the session, and clears stale settlement fields. The Next.js dialog exposes a `Correct count` action that switches the pending-approval view back to count entry while continuing to use the existing API contract.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Next.js, React, TypeScript, existing drawer session APIs and UI components.

---

### Task 1: Add the backend recount contract

**Files:**
- Modify: `C:\yummy_backend\app\services\drawer_session_service.py`
- Modify: `C:\yummy_backend\tests\day_close\test_drawer_closing_flow_spec.py`

- [ ] **Step 1: Add a failing service test**

Create a test that submits an incorrect zero closing count, verifies `variance_review_required`, submits a corrected count with a correction reason, and asserts that the session values are recalculated while both the original closing count and new recount remain in `session.counts`.

- [ ] **Step 2: Run the focused test before implementation**

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py -q --tb=short --disable-warnings
```

Expected: the new test fails with `Drawer is not ready for a closing count`.

- [ ] **Step 3: Implement the recount transition**

Allow `submit_closing_count` from `variance_review_required`. Require a reason of at least five characters for this state, write `DrawerCountType.recount` instead of `closing`, recalculate expected/count/variance/status, and clear approval and settlement fields that cannot survive a corrected physical count.

- [ ] **Step 4: Run focused backend tests**

Run the command from Step 2. Expected: all tests pass.

### Task 2: Add Correct Count to the web reconciliation dialog

**Files:**
- Modify: `components/day-close/drawer-count-dialog.tsx`
- Modify: `scripts/__tests__/day-close-control-ui-contract.test.js`

- [ ] **Step 1: Add failing UI contract assertions**

Require `Correct count`, `Submit corrected count`, and a local recount-mode state in the dialog source.

- [ ] **Step 2: Verify the UI contract fails**

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
```

Expected: failure because recount controls do not exist.

- [ ] **Step 3: Implement recount mode**

For `variance_review_required`, show `Correct count`. Activating it reveals actual cash count, denomination notes, and mandatory correction reason; submission uses the existing closing-count endpoint. Keep settlement approval available until recount mode is activated, and allow cancelling recount mode without changing backend state.

- [ ] **Step 4: Verify web contracts and types**

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: tests pass and TypeScript exits with code 0.

### Task 3: Regression verification

**Files:**
- Verify only: backend and web files above

- [ ] **Step 1: Run drawer and accounting review tests**

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py tests\finance\test_drawer_settlement_decision_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

- [ ] **Step 2: Run web lint**

```powershell
npm run lint
```

- [ ] **Step 3: Run `git diff --check` in both repositories**

Expected: no whitespace errors and no new lint errors.
