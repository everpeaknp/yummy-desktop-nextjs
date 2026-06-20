# Retained Float Opening Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry an approved retained drawer balance into the next opening as a locked, backend-enforced amount while preserving an approved physical-difference path.

**Architecture:** Treat `previous_retained_float` as an authoritative opening source independent of flexible-opening policy. The backend rejects a different opening count without reason and approver identity. The Next.js panel refreshes form state from each new suggestion, locks the retained amount by default, and exposes a permission-gated `Report different amount` mode.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Next.js, React, TypeScript, existing drawer suggestion/opening APIs and granular permissions.

---

### Task 1: Enforce retained opening continuity in the backend

**Files:**
- Modify: `C:\yummy_backend\app\services\drawer_session_service.py`
- Modify: `C:\yummy_backend\tests\day_close\test_drawer_closing_flow_spec.py`

- [ ] **Step 1: Add failing retained-float tests**

Create an approved drawer with `retained_float=1600`, request the next opening suggestion, and assert source `previous_retained_float`. Verify opening at another amount fails without a reason and approver, then verify an approved difference records suggested cash `1600`, the actual count, variance, reason, and opening-variance approval.

- [ ] **Step 2: Run the focused tests before implementation**

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py -q --tb=short --disable-warnings
```

Expected: the mismatch test fails because flexible opening currently converts the submitted amount into the baseline.

- [ ] **Step 3: Implement authoritative carry-forward**

In `open_session`, set `manual_opening` only when opening variance is not enforced and suggestion source is not `previous_retained_float`. For retained carry-forward, calculate variance against the suggested retained amount and require a reason of at least five characters plus `approved_by_id` whenever the actual count differs by more than half a cent.

- [ ] **Step 4: Run focused backend tests**

Run the command from Step 2. Expected: all tests pass.

### Task 2: Lock and refresh retained opening in Next.js

**Files:**
- Modify: `components/day-close/drawer-session-panel.tsx`
- Modify: `scripts/__tests__/day-close-control-ui-contract.test.js`

- [ ] **Step 1: Add failing UI contract assertions**

Require `previous_retained_float`, `Confirm and open`, `Report different amount`, and retained-opening override state in the panel source.

- [ ] **Step 2: Verify the UI contract fails**

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
```

- [ ] **Step 3: Implement retained opening confirmation**

Refresh opening form cash from every newly loaded suggestion unless the user is actively editing an approved difference. When source is `previous_retained_float`, render the amount read-only, replace flexible-opening copy with carry-forward confirmation copy, and label the button `Confirm and open`. Users with `day_close.drawer.approve` may activate `Report different amount`, enter the actual amount and mandatory reason, and submit their user id as `approved_by_id`.

- [ ] **Step 4: Verify web contracts and types**

```powershell
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit --pretty false
```

### Task 3: Regression verification

- [ ] **Step 1: Run drawer and accounting review tests**

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py tests\finance\test_drawer_settlement_decision_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

- [ ] **Step 2: Run web lint and patch checks**

```powershell
npm run lint
git diff --check
```

Expected: no test failures, no TypeScript errors, no new lint errors, and no whitespace errors.
