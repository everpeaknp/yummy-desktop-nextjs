# Day Close and Accounting Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build drawer-based cash control, separate operational day-close confirmation from accounting approval, and make accounting period locking depend on reviewed daily closes.

**Architecture:** Add focused drawer-session and daily-accounting-review domains beside the existing restaurant day-close. Day-close remains the immutable operational evidence packet; finance events and journals remain the accounting spine; persistent daily reviews govern accounting readiness; accounting periods remain the only financial lock authority.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, PostgreSQL, Pydantic v2, pytest, Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Node contract tests.

---

## File Structure

### Backend

- Create `C:\yummy_backend\app\models\drawer_session_model.py`: drawer configuration, session, count, movement, and approval records.
- Create `C:\yummy_backend\app\models\day_close_accounting_review_model.py`: persistent accounting disposition for each day close.
- Create `C:\yummy_backend\app\schema\drawer_session_schema.py`: drawer-session request and response contracts.
- Extend `C:\yummy_backend\app\schema\accounting_schema.py`: daily-review response and approval contracts.
- Create `C:\yummy_backend\app\repositories\drawer_session_repository.py`: drawer-session persistence and locking queries.
- Create `C:\yummy_backend\app\services\drawer_session_service.py`: opening, movements, closing count, variance, and approval rules.
- Create `C:\yummy_backend\app\services\day_close_accounting_review_service.py`: persistent review evaluation, invalidation, and approval.
- Modify `C:\yummy_backend\app\services\day_close_accounting_bridge_service.py`: posting becomes an accounting assessment instead of an operational confirmation blocker.
- Modify `C:\yummy_backend\app\services\day_close_service.py`: require drawer completion, store operational confirmation, and use atomic variance correction/reopening.
- Modify `C:\yummy_backend\app\services\accounting_period_service.py`: require reviewed daily closes before lock.
- Modify `C:\yummy_backend\app\services\period_close_service.py`: label weekly/monthly close as operational summary and expose accounting coverage.
- Create `C:\yummy_backend\app\controller\drawer_session_controller.py`: drawer workflow endpoints.
- Modify `C:\yummy_backend\app\controller\day_close_controller.py`: operational confirmation response and accounting-review status.
- Modify `C:\yummy_backend\app\controller\accounting_controller.py`: daily review, approval, correction, and drilldown endpoints.
- Create `C:\yummy_backend\migrations\versions\20260615_drawer_sessions_and_daily_reviews.py`: tables, enums, indexes, and legacy backfill.
- Create focused tests under `C:\yummy_backend\tests\finance\` and `C:\yummy_backend\tests\day_close\`.

### Frontend

- Create `components/day-close/drawer-session-panel.tsx`: cashier opening and closing workflow.
- Create `components/day-close/drawer-count-dialog.tsx`: amount and denomination counting.
- Create `components/day-close/operational-close-status.tsx`: clear operational versus accounting state.
- Modify `components/analytics/day-close-modal.tsx`: include drawer readiness and operational confirmation result.
- Modify `components/analytics/day-close-snapshot-panel.tsx`: render drawer evidence and accounting disposition.
- Modify `components/finance/accounting/day-close-review-client.tsx`: full accountant daily review packet.
- Modify `components/finance/accounting/accounting-periods-client.tsx`: daily-review coverage in period preflight.
- Modify `app/(dashboard)/period-reports/page.tsx`: relabel as operational period reports.
- Extend `lib/api/endpoints.ts`, `types/day-close.ts`, and `types/accounting.ts`.
- Extend `scripts/__tests__/accounting-ui-contract.test.js` and add `scripts/__tests__/day-close-control-ui-contract.test.js`.

---

### Task 1: Add Drawer and Daily Review Persistence

**Files:**
- Create: `C:\yummy_backend\app\models\drawer_session_model.py`
- Create: `C:\yummy_backend\app\models\day_close_accounting_review_model.py`
- Modify: `C:\yummy_backend\app\models\business_day_close_model.py`
- Create: `C:\yummy_backend\migrations\versions\20260615_drawer_sessions_and_daily_reviews.py`
- Test: `C:\yummy_backend\tests\finance\test_drawer_session_models_spec.py`

- [ ] **Step 1: Write failing model and migration tests**

```python
def test_drawer_session_has_unique_open_session_constraint():
    names = {constraint.name for constraint in DrawerSession.__table__.constraints}
    assert "uq_open_drawer_session_scope" in names


def test_day_close_has_one_persistent_accounting_review():
    assert DayCloseAccountingReview.__table__.c.day_close_id.unique is True
```

- [ ] **Step 2: Run tests and verify missing models fail**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\finance\test_drawer_session_models_spec.py -q`

Expected: collection fails because the new models do not exist.

- [ ] **Step 3: Implement focused models**

Define:

```python
class DrawerSessionStatus(str, enum.Enum):
    draft = "draft"
    opened = "opened"
    closing_count_required = "closing_count_required"
    closed = "closed"
    variance_review_required = "variance_review_required"
    approved = "approved"
    reopened = "reopened"


class DayCloseAccountingReviewStatus(str, enum.Enum):
    review_required = "review_required"
    ready = "ready"
    reviewed = "reviewed"
    invalidated = "invalidated"
```

`DrawerSession` stores restaurant, business line, station, drawer key, cashier, business date, exact timestamps, standard/suggested/counted opening cash, expected/counted closing cash, variance, retained float, status, approver, reason, and version.

`DrawerMovement` stores immutable `cash_sale`, `cash_refund`, `manual_income`, `receivable_collection`, `expense`, `inventory_payment`, `supplier_payment`, `cash_drop`, `transfer_in`, `transfer_out`, and `adjustment` movements with source keys.

`DayCloseAccountingReview` stores the review status, health metrics, source snapshot hash, reviewer, invalidation reason, and variance event/journal ids.

- [ ] **Step 4: Add Alembic migration and legacy review backfill**

The migration must:

```python
op.create_table(
    "drawer_sessions",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurant_info.id", ondelete="CASCADE"), nullable=False),
    sa.Column("business_line", sa.String(20), nullable=False, server_default="restaurant"),
    sa.Column("station", sa.String(100), nullable=False),
    sa.Column("drawer_key", sa.String(100), nullable=False),
    sa.Column("business_date", sa.Date(), nullable=False),
    sa.Column("status", drawer_session_status, nullable=False),
    sa.Column("counted_opening_cash", sa.Numeric(14, 2), nullable=True),
    sa.Column("expected_closing_cash", sa.Numeric(14, 2), nullable=True),
    sa.Column("counted_closing_cash", sa.Numeric(14, 2), nullable=True),
    sa.Column("cash_variance", sa.Numeric(14, 2), nullable=True),
)
op.create_table(
    "drawer_movements",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column("drawer_session_id", sa.Integer(), sa.ForeignKey("drawer_sessions.id", ondelete="CASCADE"), nullable=False),
    sa.Column("source_key", sa.String(255), nullable=False),
    sa.Column("movement_type", sa.String(50), nullable=False),
    sa.Column("signed_amount", sa.Numeric(14, 2), nullable=False),
    sa.UniqueConstraint("drawer_session_id", "source_key", name="uq_drawer_movement_source"),
)
op.create_table(
    "drawer_counts",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column("drawer_session_id", sa.Integer(), sa.ForeignKey("drawer_sessions.id", ondelete="CASCADE"), nullable=False),
    sa.Column("count_type", sa.String(20), nullable=False),
    sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
    sa.Column("denominations_json", postgresql.JSONB(), nullable=True),
)
op.create_table(
    "day_close_accounting_reviews",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column("day_close_id", sa.Integer(), sa.ForeignKey("business_day_closes.id", ondelete="CASCADE"), nullable=False, unique=True),
    sa.Column("status", day_close_review_status, nullable=False),
    sa.Column("source_snapshot_hash", sa.String(128), nullable=False),
    sa.Column("blockers_json", postgresql.JSONB(), nullable=False, server_default="[]"),
)
```

Backfill one review row per confirmed legacy day close. Use `review_required` when accounting bridge metadata is absent or blocked; use `ready` only when stored metadata has no blockers. Do not fabricate historical drawer sessions or opening counts.

- [ ] **Step 5: Verify migration graph and tests**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m alembic heads
.\venv\Scripts\python.exe -m pytest tests\finance\test_drawer_session_models_spec.py -q
```

Expected: one Alembic head and all model tests pass.

- [ ] **Step 6: Commit**

```powershell
git add app/models migrations/versions tests/finance/test_drawer_session_models_spec.py
git commit -m "feat(day-close): add drawer sessions and daily accounting reviews"
```

### Task 2: Implement Drawer Opening Float and Movement Rules

**Files:**
- Create: `C:\yummy_backend\app\schema\drawer_session_schema.py`
- Create: `C:\yummy_backend\app\repositories\drawer_session_repository.py`
- Create: `C:\yummy_backend\app\services\drawer_session_service.py`
- Test: `C:\yummy_backend\tests\day_close\test_drawer_opening_flow_spec.py`

- [ ] **Step 1: Write failing opening-float tests**

```python
async def test_suggested_float_uses_previous_retained_float_then_configured_float(db):
    suggestion = await service.suggest_opening_float(
        restaurant_id=restaurant.id,
        business_line="restaurant",
        station="bar",
        drawer_key="bar-1",
    )
    assert suggestion.amount == Decimal("5000.00")
    assert suggestion.source == "previous_retained_float"


async def test_opening_override_requires_reason_and_manager_above_tolerance(db):
    with pytest.raises(ValueError, match="manager approval"):
        await service.open_session(
            restaurant_id=restaurant.id,
            business_line="restaurant",
            station="bar",
            drawer_key="bar-1",
            cashier_id=cashier.id,
            counted_opening_cash=Decimal("7000.00"),
            reason=None,
            approved_by_id=None,
        )
```

- [ ] **Step 2: Run tests and confirm service is missing**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_opening_flow_spec.py -q`

- [ ] **Step 3: Implement opening suggestion and confirmation**

Use this rule:

```python
suggested = previous.approved_retained_float if previous else drawer.standard_float
variance = counted_opening_cash - suggested
requires_approval = abs(variance) > drawer.opening_variance_tolerance
```

Reject a second open session for the same drawer scope. Persist the count and approval evidence. Do not create revenue or expense for opening float.

- [ ] **Step 4: Implement idempotent drawer movement recording**

```python
async def record_movement(self, session_id: int, payload: DrawerMovementCreate):
    existing = await self.repo.get_movement_by_source_key(session_id, payload.source_key)
    if existing:
        return existing
    return await self.repo.create_movement(session_id, payload)
```

- [ ] **Step 5: Run drawer tests**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_opening_flow_spec.py -q`

Expected: opening suggestion, tolerance, immutability, and movement idempotency tests pass.

- [ ] **Step 6: Commit**

```powershell
git add app/schema/drawer_session_schema.py app/repositories/drawer_session_repository.py app/services/drawer_session_service.py tests/day_close/test_drawer_opening_flow_spec.py
git commit -m "feat(day-close): implement drawer opening float controls"
```

### Task 3: Implement Drawer Closing and Cash Reconciliation

**Files:**
- Modify: `C:\yummy_backend\app\services\drawer_session_service.py`
- Create: `C:\yummy_backend\tests\day_close\test_drawer_closing_flow_spec.py`

- [ ] **Step 1: Write failing cash-formula tests**

```python
async def test_expected_cash_uses_only_physical_cash_movements(db):
    result = await service.calculate_expected_closing_cash(session.id)
    assert result == Decimal("6125.00")


async def test_card_and_fonepay_do_not_change_drawer_expected_cash(db):
    assert await service.calculate_expected_closing_cash(session.id) == opening_cash
```

- [ ] **Step 2: Implement the canonical formula**

```python
INFLOW_TYPES = {"cash_sale", "manual_income", "receivable_collection", "transfer_in"}
OUTFLOW_TYPES = {
    "cash_refund", "expense", "inventory_payment", "supplier_payment",
    "cash_drop", "transfer_out",
}

expected = opening_cash + inflows - outflows + signed_adjustments
```

- [ ] **Step 3: Implement blind closing count and approval**

The API returns no expected amount to cashiers when blind count is enabled. After count submission, calculate variance. Move the session to `variance_review_required` above tolerance; otherwise move it to `closed`. Manager approval moves reviewed sessions to `approved` and records retained float.

- [ ] **Step 4: Verify closing tests**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_closing_flow_spec.py -q`

- [ ] **Step 5: Commit**

```powershell
git add app/services/drawer_session_service.py tests/day_close/test_drawer_closing_flow_spec.py
git commit -m "feat(day-close): reconcile drawer closing cash"
```

### Task 4: Add Drawer Session APIs and Permissions

**Files:**
- Create: `C:\yummy_backend\app\controller\drawer_session_controller.py`
- Modify: `C:\yummy_backend\app\main.py`
- Modify: `C:\yummy_backend\app\utils\permission_catalog.py`
- Test: `C:\yummy_backend\tests\day_close\test_drawer_session_api_spec.py`

- [ ] **Step 1: Write failing route contract tests**

Cover:

```text
GET  /drawer-sessions/suggestion
POST /drawer-sessions/open
POST /drawer-sessions/{id}/movements
GET  /drawer-sessions/active
POST /drawer-sessions/{id}/closing-count
POST /drawer-sessions/{id}/approve-variance
POST /drawer-sessions/{id}/reopen
```

- [ ] **Step 2: Implement routes with scoped permissions**

Use permissions:

```text
day_close.drawer.open
day_close.drawer.count
day_close.drawer.approve
day_close.drawer.reopen
```

Every mutation validates restaurant ownership, assigned cashier where applicable, and current accounting-period lock.

- [ ] **Step 3: Run API tests**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\day_close\test_drawer_session_api_spec.py -q`

- [ ] **Step 4: Commit**

```powershell
git add app/controller/drawer_session_controller.py app/main.py app tests/day_close/test_drawer_session_api_spec.py
git commit -m "feat(day-close): expose controlled drawer session APIs"
```

### Task 5: Separate Operational Confirmation from Accounting Review

**Files:**
- Create: `C:\yummy_backend\app\services\day_close_accounting_review_service.py`
- Modify: `C:\yummy_backend\app\services\day_close_accounting_bridge_service.py`
- Modify: `C:\yummy_backend\app\services\day_close_service.py`
- Modify: `C:\yummy_backend\app\schema\day_close_schema.py`
- Test: `C:\yummy_backend\tests\finance\test_day_close_accounting_review_spec.py`

- [ ] **Step 1: Write failing separation tests**

```python
async def test_operational_confirmation_succeeds_with_mapping_exception(db):
    close = await service.confirm_close(
        day_close_id=day_close.id,
        actual_cash=Decimal("5000.00"),
        notes="Manager confirmed physical close",
        user={"id": manager.id, "name": "Manager", "role": "admin"},
    )
    assert close.status == DayCloseStatus.CONFIRMED
    assert close.accounting_review.status == "review_required"


async def test_open_or_unapproved_drawer_blocks_operational_confirmation(db):
    with pytest.raises(HTTPException, match="drawer"):
        await service.confirm_close(
            day_close_id=day_close.id,
            actual_cash=Decimal("5000.00"),
            notes=None,
            user={"id": manager.id, "name": "Manager", "role": "admin"},
        )
```

- [ ] **Step 2: Change bridge return contract**

`run_confirmation_bridge()` must return assessment data and never raise for accounting health blockers. It may raise only when finance-event persistence or snapshot integrity fails.

```python
assessment = await bridge.assess_confirmation(
    day_close,
    expected_cash=expected,
    actual_cash=actual_cash,
    snapshot_data=detailed_snapshot,
    actor_id=user_id,
)
review = await review_service.upsert_from_assessment(day_close, assessment)
day_close.status = DayCloseStatus.CONFIRMED
```

- [ ] **Step 3: Add drawer evidence to snapshot**

Snapshot fields include drawer ids, opening counts, movement totals, expected and counted closing cash, variances, approvals, and retained floats. Restaurant expected cash equals the sum of included drawer expected cash plus approved non-drawer cash custody.

- [ ] **Step 4: Run review tests and existing bridge tests**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_day_close_accounting_review_spec.py tests\finance\test_day_close_accounting_bridge_spec.py tests\day_close_exact_window_spec.py -q
```

- [ ] **Step 5: Commit**

```powershell
git add app/services/day_close_accounting_review_service.py app/services/day_close_accounting_bridge_service.py app/services/day_close_service.py app/schema/day_close_schema.py tests
git commit -m "refactor(day-close): separate operational close from accounting review"
```

### Task 6: Make Cash Corrections and Reopening Atomic

**Files:**
- Modify: `C:\yummy_backend\app\services\day_close_accounting_bridge_service.py`
- Modify: `C:\yummy_backend\app\services\day_close_accounting_review_service.py`
- Modify: `C:\yummy_backend\app\services\day_close_service.py`
- Test: `C:\yummy_backend\tests\finance\test_day_close_variance_correction_spec.py`

- [ ] **Step 1: Write failing reversal/repost tests**

```python
async def test_cash_correction_reverses_old_variance_and_posts_new_variance(db):
    corrected = await service.adjust_closed_day_cash_reconciliation(
        day_close_id=day_close.id,
        actual_cash=Decimal("4950.00"),
        reason="Recount verified",
        notes="Two Rs. 25 notes were omitted",
        user={"id": manager.id, "name": "Manager", "role": "admin"},
    )
    assert corrected.cash_discrepancy == Decimal("-50.00")
    assert await active_variance_journal_amount(db, corrected.id) == Decimal("50.00")


async def test_reopen_fails_when_variance_reversal_fails(db, monkeypatch):
    monkeypatch.setattr(bridge, "reverse_cash_variance_for_reopen", AsyncMock(side_effect=ValueError("locked")))
    with pytest.raises(ValueError, match="locked"):
        await service.reopen_day(
            day_close_id=day_close.id,
            reason="Incorrect closing count",
            user={"id": manager.id, "name": "Manager", "role": "admin"},
        )
```

- [ ] **Step 2: Implement replace-variance transaction**

```python
async def replace_cash_variance(self, day_close, expected_cash, actual_cash, actor_id):
    await self.reverse_existing_variance(day_close, actor_id=actor_id)
    event = await self.record_variance(day_close, expected_cash, actual_cash)
    journal = await self.post_variance(event)
    return event, journal
```

Do not catch and suppress reversal errors. Invalidate the daily accounting review and dependent operational period snapshots in the same database transaction.

- [ ] **Step 3: Reject historical mutation in locked periods**

Return a structured conflict instructing the user to create a later-period correction voucher when the original accounting period is locked.

- [ ] **Step 4: Run correction and lock-policy tests**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\finance\test_day_close_variance_correction_spec.py tests\lock_policy_day_close_spec.py -q`

- [ ] **Step 5: Commit**

```powershell
git add app/services tests/finance/test_day_close_variance_correction_spec.py tests/lock_policy_day_close_spec.py
git commit -m "fix(accounting): make day-close variance corrections atomic"
```

### Task 7: Add Accounting Review Approval and Drilldown APIs

**Files:**
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Modify: `C:\yummy_backend\app\services\day_close_accounting_review_service.py`
- Test: `C:\yummy_backend\tests\finance\test_day_close_review_api_spec.py`

- [ ] **Step 1: Write failing approval tests**

Cover evaluation, approval, invalidation, source evidence, and authorization:

```text
GET  /accounting/day-closes/{id}/review
POST /accounting/day-closes/{id}/evaluate
POST /accounting/day-closes/{id}/approve
GET  /accounting/day-closes/{id}/evidence
GET  /accounting/day-closes/{id}/journal-trace
```

- [ ] **Step 2: Implement approval guard**

```python
if review.blockers:
    raise ValueError("Accounting review has unresolved blockers.")
if review.source_snapshot_hash != current_snapshot_hash:
    raise ValueError("Day-close evidence changed; evaluate again before approval.")
```

Approval records reviewer, timestamp, metrics, and source hash. Mapping changes remain forward-only; historical fixes require correction voucher or reverse/repost.

- [ ] **Step 3: Run API tests**

Run: `cd C:\yummy_backend && .\venv\Scripts\python.exe -m pytest tests\finance\test_day_close_review_api_spec.py -q`

- [ ] **Step 4: Commit**

```powershell
git add app/schema/accounting_schema.py app/controller/accounting_controller.py app/services/day_close_accounting_review_service.py tests/finance/test_day_close_review_api_spec.py
git commit -m "feat(accounting): add daily close review approval workflow"
```

### Task 8: Enforce Daily Review Coverage in Accounting Periods

**Files:**
- Modify: `C:\yummy_backend\app\services\accounting_period_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\services\period_close_service.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_period_daily_review_spec.py`
- Test: `C:\yummy_backend\tests\period_close_spec.py`

- [ ] **Step 1: Write failing period preflight tests**

```python
async def test_period_lock_requires_all_operational_days_reviewed(db):
    preflight = await service.preflight(period.id)
    assert preflight.can_lock is False
    assert preflight.unreviewed_day_closes == 1


async def test_operational_weekly_report_does_not_lock_accounting_period(db):
    await period_close_service.confirm_weekly_close(
        restaurant_id=restaurant.id,
        year=2026,
        week_number=24,
        user_id=manager.id,
    )
    assert accounting_period.status == AccountingPeriodStatus.open
```

- [ ] **Step 2: Add daily-review coverage to preflight**

Return:

```python
required_day_closes: int
reviewed_day_closes: int
unreviewed_day_closes: int
missing_operational_days: list[date]
invalidated_review_days: list[date]
```

Add blockers for missing operational close, review-required close, and invalidated review.

- [ ] **Step 3: Relabel operational period-close responses**

Add `authority="operational_summary"` and `accounting_period_status` to weekly/monthly report responses. Do not change accounting period status from `PeriodCloseService`.

- [ ] **Step 4: Run period tests**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_period_daily_review_spec.py tests\period_close_spec.py tests\finance\test_accounting_period_lock_spec.py -q
```

- [ ] **Step 5: Commit**

```powershell
git add app/services/accounting_period_service.py app/services/period_close_service.py app/schema/accounting_schema.py tests
git commit -m "feat(accounting): gate period locks on reviewed daily closes"
```

### Task 9: Build Drawer Opening and Closing UI

**Files:**
- Create: `components/day-close/drawer-session-panel.tsx`
- Create: `components/day-close/drawer-count-dialog.tsx`
- Create: `components/day-close/operational-close-status.tsx`
- Modify: `components/analytics/day-close-modal.tsx`
- Modify: `components/analytics/day-close-snapshot-panel.tsx`
- Modify: `lib/api/endpoints.ts`
- Modify: `types/day-close.ts`
- Create: `scripts/__tests__/day-close-control-ui-contract.test.js`

- [ ] **Step 1: Write failing frontend contract tests**

Assert the UI exposes opening float source, counted float, blind closing count, variance approval, drawer readiness, operational confirmation, and accounting-review status.

Run: `node scripts/__tests__/day-close-control-ui-contract.test.js`

Expected: failures for missing components and endpoint helpers.

- [ ] **Step 2: Add typed API contracts**

```ts
export type DrawerSession = {
  id: number;
  station: string;
  drawer_key: string;
  status: DrawerSessionStatus;
  suggested_opening_cash: number;
  counted_opening_cash?: number | null;
  expected_closing_cash?: number | null;
  counted_closing_cash?: number | null;
  cash_variance?: number | null;
};
```

- [ ] **Step 3: Implement cashier drawer workflow**

Use compact operational panels, not accounting cards. Show one primary action based on state: `Open drawer`, `Count drawer`, `Request variance approval`, or `Closed`. Hide expected closing cash during blind count.

- [ ] **Step 4: Update day-close confirmation result**

After confirmation show:

```text
Operational day closed
Accounting ready
```

or:

```text
Operational day closed
Accounting review required: 2 mapping exceptions
```

Do not instruct cashiers to edit mappings.

- [ ] **Step 5: Run contracts, lint, and TypeScript**

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\day-close-control-ui-contract.test.js
npm run lint
npx tsc --noEmit --pretty false
```

- [ ] **Step 6: Commit**

```powershell
git add components/day-close components/analytics/day-close-modal.tsx components/analytics/day-close-snapshot-panel.tsx lib/api/endpoints.ts types/day-close.ts scripts/__tests__/day-close-control-ui-contract.test.js
git commit -m "feat(day-close): add drawer opening and closing workflow"
```

### Task 10: Expand Accountant Daily Review UI

**Files:**
- Modify: `components/finance/accounting/day-close-review-client.tsx`
- Modify: `components/finance/accounting/accounting-periods-client.tsx`
- Modify: `types/accounting.ts`
- Modify: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Extend failing accounting UI contracts**

Require sections for operational status, review status, drawer reconciliation, sales, collections, refunds, operating expenses, inventory outflows, receivables, instruments, accounting checks, corrections, audit trail, and source trace.

- [ ] **Step 2: Replace soft-close day action with review workflow**

Primary accountant actions become:

- Evaluate accounting.
- Post missing events.
- Resolve mappings.
- Open settlement reconciliation.
- Create correction voucher.
- Approve daily review.

Keep the evidence snapshot read-only.

- [ ] **Step 3: Show period coverage**

Accounting period preflight displays required, reviewed, unreviewed, missing, and invalidated days with links to each daily review.

- [ ] **Step 4: Run frontend verification**

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npm run lint
npx tsc --noEmit --pretty false
```

- [ ] **Step 5: Commit**

```powershell
git add components/finance/accounting types/accounting.ts scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat(accounting): add accountant daily close review workflow"
```

### Task 11: Clarify Operational Period Reports

**Files:**
- Modify: `app/(dashboard)/period-reports/page.tsx`
- Modify: `app/(dashboard)/finance/accounting/period-reports/page.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Modify: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Add failing terminology tests**

Require visible text `Operational Period Reports` and an explanation that accounting lock is controlled from Accounting Periods. Reject labels that imply weekly/monthly report confirmation locks the ledger.

- [ ] **Step 2: Update navigation and authority labels**

Keep `/period-reports` compatible. The accounting alias links to the same operational summary but adds a clear return link to Accounting Periods for financial locking.

- [ ] **Step 3: Run contract tests**

Run: `cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs && node scripts\__tests__\accounting-ui-contract.test.js`

- [ ] **Step 4: Commit**

```powershell
git add app components/finance/accounting/accounting-nav.tsx scripts/__tests__/accounting-ui-contract.test.js
git commit -m "refactor(accounting): clarify operational period report authority"
```

### Task 12: Migration, Backfill, and End-to-End Verification

**Files:**
- Create: `docs/superpowers/runbooks/day-close-accounting-control-rollout.md`
- Test: all focused backend and frontend suites.

- [ ] **Step 1: Run migration on a disposable database**

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m alembic current
```

Expected: the new drawer/review revision is the single head.

- [ ] **Step 2: Verify legacy backfill**

Confirm:

- each legacy confirmed day close has one accounting review record;
- no synthetic counted opening float is fabricated;
- existing finance-event and journal links remain unchanged;
- operational snapshots remain readable.

- [ ] **Step 3: Run backend regression matrix**

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\day_close tests\day_close_exact_window_spec.py tests\lock_policy_day_close_spec.py tests\period_close_spec.py tests\finance\test_day_close_accounting_bridge_spec.py tests\finance\test_day_close_accounting_review_spec.py tests\finance\test_day_close_variance_correction_spec.py tests\finance\test_accounting_period_daily_review_spec.py tests\finance\test_accounting_period_lock_spec.py -q
```

- [ ] **Step 4: Run frontend verification matrix**

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

- [ ] **Step 5: Perform manual acceptance scenarios**

1. Open a drawer with standard float and matching count.
2. Record cash sale, card sale, cash expense, cash refund, and cash drop; verify only physical cash affects expected drawer cash.
3. Close with matching cash; operational close confirms and accounting review becomes ready.
4. Create a missing mapping; operational close still confirms and review becomes required.
5. Resolve mapping and approve accounting review.
6. Correct closing cash; verify prior variance journal reverses and new variance posts.
7. Reopen an open-period day; verify review invalidation and variance reversal.
8. Attempt historical reopen in locked period; verify later-period correction guidance.
9. Attempt period lock with an unreviewed day; verify blocker and drilldown.
10. Lock the period after all daily reviews pass.

- [ ] **Step 6: Final commit**

```powershell
git add docs/superpowers/runbooks/day-close-accounting-control-rollout.md
git commit -m "docs(accounting): document day-close control rollout"
```

---

## Rollout Order

1. Deploy schema and backend services with drawer controls disabled by restaurant feature flag.
2. Backfill persistent accounting-review rows for legacy confirmed closes.
3. Enable drawer sessions for one test restaurant and preserve legacy restaurant-level opening balance as display-only compatibility data.
4. Verify cash formulas against physical counts for at least seven business days.
5. Enable operational/accounting status separation.
6. Enable accounting-period daily-review blockers.
7. Remove legacy previous-close-derived opening balance from authoritative cash calculations after rollout evidence is accepted.

## Non-Negotiable Verification Rules

- Do not apply migrations to production before disposable-database verification.
- Do not fabricate historical drawer counts.
- Do not mutate posted journals when mappings change.
- Do not allow a failed variance reversal to reopen or correct a close.
- Do not let operational period reports change accounting-period status.
- Do not call a period accounting-ready while any included daily review is unresolved.
