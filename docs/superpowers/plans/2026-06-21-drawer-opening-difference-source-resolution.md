# Drawer Opening Difference Source Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening a retained-float drawer with a different physical amount must require an explicit source and create the correct accounting movement.

**Architecture:** Keep the drawer session as the operational source of truth, but convert retained-opening differences into either a source-backed drawer movement and finance event or a controlled cash variance. Safe-to-drawer differences post as `safe_drawer_transfer_recorded` so the ledger debits drawer cash and credits main cash safe.

**Tech Stack:** FastAPI/Pydantic, SQLAlchemy async services, existing finance events/accounting mappings, Next.js React drawer panel.

---

### Task 1: Backend Opening Difference Contract

**Files:**
- Modify: `C:/yummy_backend/app/schema/drawer_session_schema.py`
- Modify: `C:/yummy_backend/app/models/finance_event_model.py`
- Modify: `C:/yummy_backend/app/services/accounting_service.py`
- Modify: `C:/yummy_backend/app/services/accounting_setup_service.py`
- Modify: `C:/yummy_backend/app/services/accounting_daybook_service.py`

- [x] Add `opening_difference_source`, `opening_difference_destination`, and `opening_difference_reference` to `DrawerSessionOpenRequest`.
- [x] Add finance event type `safe_drawer_transfer_recorded`.
- [x] Add default ledger mapping `safe_drawer_transfer_recorded: Dr 1000 Cashier Drawer Cash, Cr 1005 Main Cash Safe`.
- [x] Add daybook transfer labeling for safe-to-drawer transfers.

### Task 2: Backend Source Resolution Behavior

**Files:**
- Modify: `C:/yummy_backend/app/services/drawer_session_service.py`
- Test: `C:/yummy_backend/tests/finance/test_drawer_opening_difference_source_spec.py`

- [x] When retained opening differs and source is `safe_transfer`, require a reason and approval, create a `safe_drawer_transfer_recorded` finance event, and post accounting without adding a drawer movement that would double-count expected cash.
- [x] When retained opening differs and source is missing, reject with a clear error.
- [x] Keep `cash_over_short` as a manager-approved fallback and record `cash_variance_recorded`.

### Task 3: Web Opening Difference Resolver

**Files:**
- Modify: `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs/types/day-close.ts`
- Modify: `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs/components/day-close/drawer-session-panel.tsx`
- Test: `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs/scripts/__tests__/day-close-control-ui-contract.test.js`

- [x] Add source fields to `DrawerSessionOpenInput`.
- [x] Show a source selector when reporting a retained-opening difference.
- [x] Require source plus reason before submit.
- [x] Send `opening_difference_source` and optional reference in the open drawer payload.

### Task 4: Verify

**Files:**
- Backend tests under `C:/yummy_backend/tests/finance/`
- Web contract and type checks under `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs/`

- [x] Run backend targeted pytest for the new drawer opening source tests and existing drawer/accounting settlement tests.
- [x] Run web contract test, TypeScript, and lint.

### Task 5: Reopened Drawer Day-Close Snapshot

**Files:**
- Modify: `C:/yummy_backend/app/services/day_close_service.py`
- Modify: `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs/components/analytics/day-close-financial-summary.tsx`
- Test: `C:/yummy_backend/tests/finance/test_drawer_opening_difference_source_spec.py`

- [x] Aggregate day-close drawer expected cash from the latest session per drawer scope instead of summing earlier closed sessions for the same drawer.
- [x] Keep earlier drawer sessions in snapshot evidence rows and mark the current session with `is_current_session`.
- [x] Change the Expected Drawer formula copy to use drawer-control evidence when present.
- [x] Add a regression test for reopening the same drawer with a safe top-up in the same business day.
