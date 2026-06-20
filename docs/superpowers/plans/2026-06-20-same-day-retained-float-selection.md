# Same-Day Retained Float Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a drawer reopened on the same business date uses the latest approved settlement's retained cash, including zero after transferring all cash to safe or bank.

**Architecture:** Keep the opening suggestion API and audit model unchanged. Correct the repository boundary so it selects the latest approved session on or before the requested business date, ordered by business date, approval time, and id; prove the behavior through the service API with a same-day close and reopen regression test.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL test database, pytest.

---

### Task 1: Reproduce same-day stale carry-forward

**Files:**
- Modify: `C:\yummy_backend\tests\day_close\test_drawer_closing_flow_spec.py`

- [ ] **Step 1: Add the failing regression test**

Add a service-level test that creates a flexible drawer, retains Rs. 1,600 in an approved session, opens another session with that carry-forward, closes it on the same business date, transfers all counted cash to safe with `retained_float=0`, and requests another opening suggestion for that same date.

Assert:

```python
assert suggestion.source == "previous_retained_float"
assert suggestion.amount == Decimal("0.00")
```

- [ ] **Step 2: Run the test and confirm the defect**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py -k "same_day_safe_transfer" -q --tb=short --disable-warnings
```

Expected before the fix: failure showing the suggestion is Rs. 1,600 because the same-date approved safe-transfer session was excluded.

### Task 2: Select the latest approved session inclusively

**Files:**
- Modify: `C:\yummy_backend\app\repositories\drawer_session_repository.py`
- Test: `C:\yummy_backend\tests\day_close\test_drawer_closing_flow_spec.py`

- [ ] **Step 1: Make the date boundary inclusive**

Rename `before_date` to `on_or_before_date` and change the SQLAlchemy predicate to:

```python
DrawerSession.business_date <= on_or_before_date
```

Keep the existing scope, approved-status, non-null-retained-float filters and descending ordering unchanged.

- [ ] **Step 2: Run the focused regression test**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py -k "same_day_safe_transfer" -q --tb=short --disable-warnings
```

Expected: pass.

- [ ] **Step 3: Run the drawer and settlement suites**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py tests\finance\test_drawer_settlement_decision_spec.py -q --tb=short --disable-warnings
```

Expected: all tests pass.

- [ ] **Step 4: Check the patch for accidental changes**

Run:

```powershell
git diff --check
git diff -- app/repositories/drawer_session_repository.py tests/day_close/test_drawer_closing_flow_spec.py
```

Expected: no whitespace errors and only the inclusive lookup plus regression test.
