# Backend And Next.js Cash Control Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully implement and test the phase 1 cash-control accounting loop in `C:\yummy_backend` and `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`, with Flutter explicitly excluded.

**Architecture:** The backend remains the source of truth for COA, mappings, drawer sessions, finance events, journals, daybook data, exceptions, settlements, and audit state. Next.js provides a clean, minimal, responsive accounting control surface that exercises those backend contracts end to end. Existing day close, accounting, drawer, settlement, and report screens are extended rather than replaced wholesale.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, pytest, Next.js 14 App Router, TypeScript, Tailwind, shadcn/Radix UI, lucide-react.

---

## Scope

This plan delivers the first complete backend + web cash-control loop:

- Guided accounting setup and mapping health.
- Cashier drawer evidence and settlement decisions.
- Layered daybook API and Next.js page.
- Day-close accounting blockers and review handoff.
- Navigation and UI cleanup for clean, modern, responsive use.
- Web validation of the full flow before any Flutter work begins.

This plan intentionally excludes Flutter runtime changes and full inventory valuation/COGS implementation.

## Current Code Map

Backend repo: `C:\yummy_backend`

- Existing drawer models: `app/models/drawer_session_model.py`
- Existing drawer service: `app/services/drawer_session_service.py`
- Existing drawer controller: `app/controller/drawer_session_controller.py`
- Existing drawer schemas: `app/schema/drawer_session_schema.py`
- Existing accounting models: `app/models/accounting_model.py`
- Existing accounting service/reporting: `app/services/accounting_service.py`
- Existing accounting controller: `app/controller/accounting_controller.py`
- Existing accounting schemas: `app/schema/accounting_schema.py`
- Existing day-close accounting bridge: `app/services/day_close_accounting_bridge_service.py`
- Existing day-close accounting review: `app/services/day_close_accounting_review_service.py`
- Existing payment settlement service: `app/services/payment_settlement_service.py`
- Existing tests: `tests/finance/test_*`

Next.js repo: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`

- Existing accounting endpoints: `lib/api/endpoints.ts`
- Existing accounting types: `types/accounting.ts`
- Existing day-close types: `types/day-close.ts`
- Existing accounting navigation: `components/finance/accounting/accounting-nav.tsx`
- Existing accounting setup page: `app/(dashboard)/finance/accounting/setup/page.tsx`
- Existing accounting setup client: `components/finance/accounting/accounting-setup-client.tsx`
- Existing day-close accounting review page: `app/(dashboard)/finance/accounting/day-closes/page.tsx`
- Existing day-close review client: `components/finance/accounting/day-close-review-client.tsx`
- Existing settlement UI: `components/finance/accounting/settlement-reconciliation-client.tsx`
- Existing drawer components: `components/day-close/drawer-session-panel.tsx`, `components/day-close/drawer-count-dialog.tsx`
- Existing drawer settings UI: `app/(dashboard)/manage/settings/page.tsx`
- Existing UI contract tests: `scripts/__tests__/accounting-ui-contract.test.js`, `scripts/__tests__/day-close-control-ui-contract.test.js`

## Task 1: Backend Daybook Contract

**Files:**

- Create: `C:\yummy_backend\app\services\accounting_daybook_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_daybook_spec.py`

- [ ] **Step 1: Add failing daybook service tests**

Add tests that assert the backend returns layered daybook sections with opening balance, transactions, transfers, ledger impact, exceptions, and closing balance. Use the repo's existing finance test factories and patterns from `tests/finance/test_day_close_accounting_review_spec.py` and `tests/finance/test_finance_reports_spec.py`.

```python
async def test_daybook_cash_control_groups_drawer_movements(
    async_client,
    auth_headers,
    seeded_restaurant,
):
    response = await async_client.get(
        "/accounting/daybook",
        params={
            "restaurant_id": seeded_restaurant.id,
            "business_date": "2026-06-19",
            "business_line": "restaurant",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["restaurant_id"] == seeded_restaurant.id
    assert payload["business_date"] == "2026-06-19"
    assert "cash_control" in payload
    assert "payment_instruments" in payload
    assert "transfers" in payload
    assert "ledger_impact" in payload
    assert "exceptions" in payload
    assert "opening_balance" in payload["cash_control"]
    assert "closing_balance" in payload["cash_control"]
```

- [ ] **Step 2: Run the failing backend test**

Run from `C:\yummy_backend`:

```powershell
pytest tests/finance/test_accounting_daybook_spec.py -q
```

Expected: failure because `/accounting/daybook` and the daybook schema do not exist yet.

- [ ] **Step 3: Add daybook read schemas**

Add these focused schemas to `app/schema/accounting_schema.py` near the existing report schemas:

```python
class DaybookBalanceRead(BaseModel):
    opening_balance: float = 0.0
    closing_balance: float = 0.0


class DaybookCashTransactionRead(BaseModel):
    source_type: str
    source_id: Optional[int] = None
    label: str
    occurred_at: Optional[datetime] = None
    amount: float = 0.0
    signed_amount: float = 0.0
    drawer_session_id: Optional[int] = None
    cashier_id: Optional[int] = None
    journal_entry_id: Optional[int] = None


class DaybookCashControlRead(DaybookBalanceRead):
    cash_sales: float = 0.0
    cash_refunds: float = 0.0
    drawer_expenses: float = 0.0
    transfers_out: float = 0.0
    transfers_in: float = 0.0
    variance: float = 0.0
    rows: list[DaybookCashTransactionRead] = Field(default_factory=list)


class DaybookInstrumentRead(BaseModel):
    payment_method: str
    instrument: Optional[str] = None
    expected_amount: float = 0.0
    settled_amount: float = 0.0
    clearing_status: str = "unsettled"


class DaybookLedgerImpactRead(BaseModel):
    finance_event_count: int = 0
    journal_count: int = 0
    total_debit: float = 0.0
    total_credit: float = 0.0


class DaybookExceptionRead(BaseModel):
    kind: str
    label: str
    amount: float = 0.0
    count: int = 0
    blocking: bool = False


class AccountingDaybookRead(BaseModel):
    restaurant_id: int
    business_date: date
    business_line: str = "restaurant"
    cash_control: DaybookCashControlRead
    payment_instruments: list[DaybookInstrumentRead] = Field(default_factory=list)
    transfers: list[DaybookCashTransactionRead] = Field(default_factory=list)
    ledger_impact: DaybookLedgerImpactRead
    exceptions: list[DaybookExceptionRead] = Field(default_factory=list)
```

- [ ] **Step 4: Implement `AccountingDaybookService`**

Create `app/services/accounting_daybook_service.py`. The service should compose existing data rather than invent new journal logic:

```python
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting_model import JournalEntry, JournalLine
from app.models.drawer_session_model import DrawerMovement, DrawerSession
from app.models.finance_event_model import FinanceEvent
from app.schema.accounting_schema import (
    AccountingDaybookRead,
    DaybookCashControlRead,
    DaybookCashTransactionRead,
    DaybookExceptionRead,
    DaybookInstrumentRead,
    DaybookLedgerImpactRead,
)


def _money(value) -> float:
    return float(Decimal(value or 0))


class AccountingDaybookService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_daybook(
        self,
        *,
        restaurant_id: int,
        business_date: date,
        business_line: str = "restaurant",
    ) -> AccountingDaybookRead:
        drawer_rows = await self._drawer_rows(restaurant_id, business_date, business_line)
        cash_control = self._cash_control(drawer_rows)
        instruments = await self._payment_instruments(restaurant_id, business_date, business_line)
        ledger_impact = await self._ledger_impact(restaurant_id, business_date, business_line)
        exceptions = await self._exceptions(restaurant_id, business_date, business_line, ledger_impact)
        transfers = [row for row in cash_control.rows if row.source_type in {"cash_drop", "transfer_in", "transfer_out"}]
        return AccountingDaybookRead(
            restaurant_id=restaurant_id,
            business_date=business_date,
            business_line=business_line,
            cash_control=cash_control,
            payment_instruments=instruments,
            transfers=transfers,
            ledger_impact=ledger_impact,
            exceptions=exceptions,
        )

    async def _drawer_rows(self, restaurant_id: int, business_date: date, business_line: str):
        result = await self.db.execute(
            select(DrawerMovement, DrawerSession)
            .join(DrawerSession, DrawerSession.id == DrawerMovement.drawer_session_id)
            .where(
                DrawerSession.restaurant_id == restaurant_id,
                DrawerSession.business_date == business_date,
                DrawerSession.business_line == business_line,
            )
            .order_by(DrawerMovement.occurred_at.asc(), DrawerMovement.id.asc())
        )
        return result.all()

    def _cash_control(self, drawer_rows) -> DaybookCashControlRead:
        rows: list[DaybookCashTransactionRead] = []
        opening = Decimal("0")
        closing = Decimal("0")
        cash_sales = Decimal("0")
        cash_refunds = Decimal("0")
        drawer_expenses = Decimal("0")
        transfers_in = Decimal("0")
        transfers_out = Decimal("0")
        variance = Decimal("0")
        session_ids = set()
        for movement, session in drawer_rows:
            if session.id not in session_ids:
                opening += Decimal(session.counted_opening_cash or 0)
                closing += Decimal(session.counted_closing_cash or session.expected_closing_cash or 0)
                variance += Decimal(session.cash_variance or 0)
                session_ids.add(session.id)
            signed = Decimal(movement.signed_amount or 0)
            if movement.movement_type == "cash_sale":
                cash_sales += signed
            elif movement.movement_type == "cash_refund":
                cash_refunds += abs(signed)
            elif movement.movement_type == "expense":
                drawer_expenses += abs(signed)
            elif movement.movement_type == "transfer_in":
                transfers_in += signed
            elif movement.movement_type in {"transfer_out", "cash_drop"}:
                transfers_out += abs(signed)
            rows.append(
                DaybookCashTransactionRead(
                    source_type=movement.movement_type,
                    source_id=movement.id,
                    label=movement.movement_type.replace("_", " ").title(),
                    occurred_at=movement.occurred_at,
                    amount=_money(abs(signed)),
                    signed_amount=_money(signed),
                    drawer_session_id=session.id,
                    cashier_id=session.cashier_id,
                    journal_entry_id=None,
                )
            )
        return DaybookCashControlRead(
            opening_balance=_money(opening),
            closing_balance=_money(closing),
            cash_sales=_money(cash_sales),
            cash_refunds=_money(cash_refunds),
            drawer_expenses=_money(drawer_expenses),
            transfers_out=_money(transfers_out),
            transfers_in=_money(transfers_in),
            variance=_money(variance),
            rows=rows,
        )

    async def _payment_instruments(self, restaurant_id: int, business_date: date, business_line: str):
        result = await self.db.execute(
            select(
                FinanceEvent.payment_method,
                FinanceEvent.metadata_json,
                func.sum(FinanceEvent.amount),
            )
            .where(
                FinanceEvent.restaurant_id == restaurant_id,
                FinanceEvent.business_date == business_date,
                FinanceEvent.business_line == business_line,
                func.lower(func.coalesce(FinanceEvent.payment_method, "")) != "cash",
            )
            .group_by(FinanceEvent.payment_method, FinanceEvent.metadata_json)
        )
        rows: list[DaybookInstrumentRead] = []
        for method, metadata, amount in result.all():
            instrument = None
            if isinstance(metadata, dict):
                instrument = metadata.get("instrument") or metadata.get("card_terminal") or metadata.get("qr_name")
            rows.append(
                DaybookInstrumentRead(
                    payment_method=method or "unknown",
                    instrument=instrument,
                    expected_amount=_money(amount),
                    settled_amount=0.0,
                    clearing_status="unsettled",
                )
            )
        return rows

    async def _ledger_impact(self, restaurant_id: int, business_date: date, business_line: str) -> DaybookLedgerImpactRead:
        result = await self.db.execute(
            select(
                func.count(func.distinct(JournalEntry.id)),
                func.coalesce(func.sum(JournalLine.debit), 0),
                func.coalesce(func.sum(JournalLine.credit), 0),
            )
            .join(JournalLine, JournalLine.journal_entry_id == JournalEntry.id)
            .where(
                JournalEntry.restaurant_id == restaurant_id,
                JournalEntry.business_date == business_date,
                JournalEntry.business_line == business_line,
            )
        )
        journal_count, debit, credit = result.one()
        event_count = await self.db.scalar(
            select(func.count(FinanceEvent.id)).where(
                FinanceEvent.restaurant_id == restaurant_id,
                FinanceEvent.business_date == business_date,
                FinanceEvent.business_line == business_line,
            )
        )
        return DaybookLedgerImpactRead(
            finance_event_count=int(event_count or 0),
            journal_count=int(journal_count or 0),
            total_debit=_money(debit),
            total_credit=_money(credit),
        )

    async def _exceptions(self, restaurant_id: int, business_date: date, business_line: str, impact: DaybookLedgerImpactRead):
        exceptions: list[DaybookExceptionRead] = []
        if impact.finance_event_count and not impact.journal_count:
            exceptions.append(
                DaybookExceptionRead(
                    kind="unposted_events",
                    label="Finance events exist without journals",
                    count=impact.finance_event_count,
                    blocking=True,
                )
            )
        if round(impact.total_debit - impact.total_credit, 2) != 0:
            exceptions.append(
                DaybookExceptionRead(
                    kind="trial_balance_difference",
                    label="Daybook debit and credit totals do not balance",
                    amount=round(impact.total_debit - impact.total_credit, 2),
                    blocking=True,
                )
            )
        return exceptions
```

- [ ] **Step 5: Add `/accounting/daybook` endpoint**

In `app/controller/accounting_controller.py`, import `AccountingDaybookService` and `AccountingDaybookRead`, then add:

```python
@router.get("/daybook", response_model=BaseResponse[AccountingDaybookRead])
async def get_accounting_daybook(
    restaurant_id: int = Query(..., gt=0),
    business_date: date = Query(...),
    business_line: str = Query("restaurant", pattern="^(restaurant|hotel)$"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    daybook = await AccountingDaybookService(db).get_daybook(
        restaurant_id=restaurant_id,
        business_date=business_date,
        business_line=business_line,
    )
    return BaseResponse(status="success", message="Accounting daybook fetched", data=daybook)
```

- [ ] **Step 6: Run backend daybook tests**

Run from `C:\yummy_backend`:

```powershell
pytest tests/finance/test_accounting_daybook_spec.py -q
```

Expected: pass.

- [ ] **Step 7: Commit backend daybook contract**

```powershell
git -C C:\yummy_backend add app/services/accounting_daybook_service.py app/schema/accounting_schema.py app/controller/accounting_controller.py tests/finance/test_accounting_daybook_spec.py
git -C C:\yummy_backend commit -m "feat: add accounting daybook contract"
```

## Task 2: Backend Drawer Settlement Decision

**Files:**

- Modify: `C:\yummy_backend\app\models\drawer_session_model.py`
- Modify: `C:\yummy_backend\app\schema\drawer_session_schema.py`
- Modify: `C:\yummy_backend\app\services\drawer_session_service.py`
- Modify: `C:\yummy_backend\app\controller\drawer_session_controller.py`
- Create: `C:\yummy_backend\migrations\versions\20260619_drawer_settlement_decisions.py`
- Test: `C:\yummy_backend\tests\finance\test_drawer_settlement_decision_spec.py`

- [ ] **Step 1: Write failing settlement decision tests**

Add tests for:

- closing count cannot approve without settlement decision;
- retained float cannot exceed counted closing cash;
- default pending bank deposit records `settlement_mode="pending_bank_deposit"`;
- immediate bank deposit records `settlement_mode="immediate_bank_deposit"`.

Use this assertion shape:

```python
assert session.status.value == "approved"
assert session.retained_float == Decimal("1000.00")
assert session.settlement_mode == "safe_transfer"
assert session.settlement_amount == Decimal("9000.00")
```

- [ ] **Step 2: Run failing settlement tests**

Run from `C:\yummy_backend`:

```powershell
pytest tests/finance/test_drawer_settlement_decision_spec.py -q
```

Expected: failure because settlement fields and payload are not present.

- [ ] **Step 3: Add drawer settlement columns**

Add columns to `DrawerSession`:

```python
settlement_mode = Column(String(50), nullable=True)
settlement_amount = Column(Numeric(14, 2), nullable=True)
settlement_destination = Column(String(160), nullable=True)
settlement_reference = Column(String(160), nullable=True)
```

Create Alembic migration:

```python
def upgrade():
    op.add_column("drawer_sessions", sa.Column("settlement_mode", sa.String(length=50), nullable=True))
    op.add_column("drawer_sessions", sa.Column("settlement_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("drawer_sessions", sa.Column("settlement_destination", sa.String(length=160), nullable=True))
    op.add_column("drawer_sessions", sa.Column("settlement_reference", sa.String(length=160), nullable=True))


def downgrade():
    op.drop_column("drawer_sessions", "settlement_reference")
    op.drop_column("drawer_sessions", "settlement_destination")
    op.drop_column("drawer_sessions", "settlement_amount")
    op.drop_column("drawer_sessions", "settlement_mode")
```

- [ ] **Step 4: Extend drawer schemas**

Add a settlement payload and read fields:

```python
class DrawerSettlementDecisionRequest(BaseModel):
    retained_float: Decimal = Field(default=Decimal("0"), ge=0)
    settlement_mode: str = Field(pattern="^(safe_transfer|pending_bank_deposit|immediate_bank_deposit|retain_all)$")
    settlement_amount: Decimal = Field(default=Decimal("0"), ge=0)
    settlement_destination: Optional[str] = Field(default=None, max_length=160)
    settlement_reference: Optional[str] = Field(default=None, max_length=160)
    reason: str = Field(min_length=5, max_length=1000)
```

Add these fields to `DrawerSessionRead`:

```python
settlement_mode: Optional[str] = None
settlement_amount: Optional[Decimal] = None
settlement_destination: Optional[str] = None
settlement_reference: Optional[str] = None
```

- [ ] **Step 5: Replace retained-float-only approval with settlement decision**

In `DrawerSessionService.approve_variance`, keep the existing method for compatibility but delegate to a new method:

```python
async def approve_settlement(
    self,
    session_id: int,
    *,
    approved_by_id: int,
    reason: str,
    retained_float: Decimal,
    settlement_mode: str,
    settlement_amount: Decimal,
    settlement_destination: str | None = None,
    settlement_reference: str | None = None,
) -> DrawerSession:
    session = await self.repo.get_session(session_id, for_update=True)
    if session is None:
        raise ValueError("Drawer session not found")
    if session.status not in {DrawerSessionStatus.closed, DrawerSessionStatus.variance_review_required}:
        raise ValueError("Drawer session is not awaiting settlement approval")
    await assert_accounting_period_open(
        self.db,
        restaurant_id=session.restaurant_id,
        entry_date=session.business_date,
    )
    counted = Decimal(session.counted_closing_cash or 0)
    retained_float = Decimal(retained_float)
    settlement_amount = Decimal(settlement_amount)
    if retained_float < 0 or settlement_amount < 0:
        raise ValueError("Settlement amounts cannot be negative")
    if retained_float + settlement_amount > counted:
        raise ValueError("Retained float plus settlement amount cannot exceed counted closing cash")
    if settlement_mode in {"safe_transfer", "pending_bank_deposit", "immediate_bank_deposit"} and settlement_amount <= 0:
        raise ValueError("Settlement amount is required for this settlement mode")
    if settlement_mode == "retain_all" and retained_float != counted:
        raise ValueError("Retain all requires retained float to equal counted closing cash")
    if not reason or len(reason.strip()) < 5:
        raise ValueError("Approval reason must be at least 5 characters")

    await self.repo.create_approval(
        DrawerApproval(
            drawer_session_id=session.id,
            approval_type=DrawerApprovalType.closing_variance,
            variance_amount=session.cash_variance,
            reason=reason.strip(),
            approved_by_id=approved_by_id,
            metadata_json={
                "settlement_mode": settlement_mode,
                "settlement_amount": str(settlement_amount),
                "settlement_destination": settlement_destination,
                "settlement_reference": settlement_reference,
            },
        )
    )
    session.status = DrawerSessionStatus.approved
    session.approved_by_id = approved_by_id
    session.approved_at = utc_now()
    session.retained_float = retained_float
    session.settlement_mode = settlement_mode
    session.settlement_amount = settlement_amount
    session.settlement_destination = settlement_destination
    session.settlement_reference = settlement_reference
    session.version += 1
    await self.db.flush()
    return await self.repo.get_session(session.id)
```

- [ ] **Step 6: Add settlement endpoint**

Add route:

```python
@router.post(
    "/{session_id}/settlement-decision",
    response_model=BaseResponse[DrawerSessionRead],
    dependencies=[Depends(require_permission("day_close.drawer.approve"))],
)
async def approve_settlement_decision(
    session_id: int,
    payload: DrawerSettlementDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = DrawerSessionService(db)
    session = await service.repo.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Drawer session not found")
    _assert_restaurant_scope(current_user, session.restaurant_id)
    try:
        session = await service.approve_settlement(
            session_id,
            approved_by_id=_actor_id(current_user),
            reason=payload.reason,
            retained_float=payload.retained_float,
            settlement_mode=payload.settlement_mode,
            settlement_amount=payload.settlement_amount,
            settlement_destination=payload.settlement_destination,
            settlement_reference=payload.settlement_reference,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise _service_error(exc) from exc
    return BaseResponse(message="Drawer settlement decision approved", data=session)
```

- [ ] **Step 7: Run settlement tests and migration check**

Run:

```powershell
pytest tests/finance/test_drawer_settlement_decision_spec.py tests/finance/test_drawer_session_models_spec.py -q
alembic upgrade head
```

Expected: tests pass and migration applies.

- [ ] **Step 8: Commit drawer settlement decision**

```powershell
git -C C:\yummy_backend add app/models/drawer_session_model.py app/schema/drawer_session_schema.py app/services/drawer_session_service.py app/controller/drawer_session_controller.py migrations/versions/20260619_drawer_settlement_decisions.py tests/finance/test_drawer_settlement_decision_spec.py
git -C C:\yummy_backend commit -m "feat: require drawer settlement decisions"
```

## Task 3: Backend Setup Health And Core Mapping Strictness

**Files:**

- Modify: `C:\yummy_backend\app\services\accounting_setup_service.py`
- Modify: `C:\yummy_backend\app\schema\accounting_setup_schema.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_setup_core_mapping_spec.py`

- [ ] **Step 1: Add failing setup-health tests**

Write tests that assert setup status separates blocking core mappings from non-blocking mapping gaps:

```python
assert "cashier_drawer_cash" in payload["blocking_core_mapping_keys"]
assert "card_terminal" in payload["non_blocking_mapping_keys"]
assert payload["ready"] is False
```

- [ ] **Step 2: Extend setup status schema**

Add fields to `AccountingSetupStatusRead` in `app/schema/accounting_setup_schema.py`:

```python
blocking_core_mapping_keys: list[str] = Field(default_factory=list)
non_blocking_mapping_keys: list[str] = Field(default_factory=list)
```

- [ ] **Step 3: Add explicit core mapping keys in setup service**

In `AccountingSetupService`, define:

```python
CORE_MAPPING_KEYS = {
    "cashier_drawer_cash",
    "main_cash_safe",
    "bank",
    "sales_revenue",
    "tax_payable",
    "refunds_returns",
    "cash_variance",
    "suspense",
}

NON_BLOCKING_MAPPING_KEYS = {
    "card_terminal",
    "digital_wallet",
    "drawer_expense_category",
    "custom_route",
}
```

Return both lists in setup status. Use existing missing-mapping calculation as the source for the count; do not rewrite historical journals.

- [ ] **Step 4: Surface fields in controller response**

Update `_setup_status_read` in `app/controller/accounting_controller.py`:

```python
blocking_core_mapping_keys=result.blocking_core_mapping_keys,
non_blocking_mapping_keys=result.non_blocking_mapping_keys,
```

- [ ] **Step 5: Run setup tests**

```powershell
pytest tests/finance/test_accounting_setup_core_mapping_spec.py tests/finance/test_accounting_setup_spec.py -q
```

Expected: pass.

- [ ] **Step 6: Commit setup health strictness**

```powershell
git -C C:\yummy_backend add app/services/accounting_setup_service.py app/schema/accounting_setup_schema.py app/controller/accounting_controller.py tests/finance/test_accounting_setup_core_mapping_spec.py
git -C C:\yummy_backend commit -m "feat: expose core accounting setup health"
```

## Task 4: Next.js Daybook Page

**Files:**

- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\accounting.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\accounting-nav.tsx`
- Create: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\app\(dashboard)\finance\accounting\daybook\page.tsx`
- Create: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\daybook-client.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\accounting-ui-contract.test.js`

- [ ] **Step 1: Add failing UI contract assertions**

In `scripts/__tests__/accounting-ui-contract.test.js`, assert:

```javascript
assertFileContains("components/finance/accounting/accounting-nav.tsx", "/finance/accounting/daybook");
assertFileContains("components/finance/accounting/daybook-client.tsx", "Cash Control");
assertFileContains("components/finance/accounting/daybook-client.tsx", "Payment Instruments");
assertFileContains("components/finance/accounting/daybook-client.tsx", "Ledger Impact");
assertFileContains("components/finance/accounting/daybook-client.tsx", "Exceptions");
```

- [ ] **Step 2: Run failing UI contract test**

Run from `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`:

```powershell
node scripts/__tests__/accounting-ui-contract.test.js
```

Expected: failure because daybook files and nav entry do not exist.

- [ ] **Step 3: Add endpoint and types**

Add to `AccountingApis`:

```typescript
daybook: (params: AccountingCoreParams & { businessDate: string }) => {
  const query = buildAccountingQuery(params);
  query.append("business_date", params.businessDate);
  return `/accounting/daybook?${query.toString()}`;
},
```

Add to `types/accounting.ts`:

```typescript
export type DaybookCashTransaction = {
  source_type: string;
  source_id?: number | null;
  label: string;
  occurred_at?: string | null;
  amount: number;
  signed_amount: number;
  drawer_session_id?: number | null;
  cashier_id?: number | null;
  journal_entry_id?: number | null;
};

export type AccountingDaybook = {
  restaurant_id: number;
  business_date: string;
  business_line: string;
  cash_control: {
    opening_balance: number;
    closing_balance: number;
    cash_sales: number;
    cash_refunds: number;
    drawer_expenses: number;
    transfers_out: number;
    transfers_in: number;
    variance: number;
    rows: DaybookCashTransaction[];
  };
  payment_instruments: Array<{
    payment_method: string;
    instrument?: string | null;
    expected_amount: number;
    settled_amount: number;
    clearing_status: string;
  }>;
  transfers: DaybookCashTransaction[];
  ledger_impact: {
    finance_event_count: number;
    journal_count: number;
    total_debit: number;
    total_credit: number;
  };
  exceptions: Array<{
    kind: string;
    label: string;
    amount: number;
    count: number;
    blocking: boolean;
  }>;
};
```

- [ ] **Step 4: Add nav entry**

Add `Daybook` to the Accounting Controls group in `components/finance/accounting/accounting-nav.tsx`:

```typescript
{ href: "/finance/accounting/daybook", label: "Daybook", icon: Banknote },
```

- [ ] **Step 5: Create daybook route**

Create `app/(dashboard)/finance/accounting/daybook/page.tsx`:

```typescript
import { DaybookClient } from "@/components/finance/accounting/daybook-client";

export default function AccountingDaybookPage() {
  return <DaybookClient />;
}
```

- [ ] **Step 6: Build clean responsive daybook client**

Create `components/finance/accounting/daybook-client.tsx`. Use existing `apiClient`, `useAuth`, `AccountingNav`, `Button`, `Input`, `Card`, and tab components. The client must:

- default business date to today;
- load `AccountingApis.daybook`;
- show summary metrics above tabs;
- render tabs named `Cash Control`, `Payment Instruments`, `Transfers`, `Ledger Impact`, and `Exceptions`;
- stack into a single column on mobile;
- use tables only inside each tab;
- show clear empty/loading/error states.

Use this page structure:

```tsx
<main className="min-h-screen bg-background p-4 md:p-6">
  <div className="mx-auto flex max-w-7xl flex-col gap-5">
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Daybook</h1>
        <p className="text-sm text-muted-foreground">
          Opening balance, drawer movements, transfers, ledger impact, and exceptions for one business day.
        </p>
      </div>
    </header>
    <AccountingNav />
    {/* filters, metrics, tabs */}
  </div>
</main>
```

- [ ] **Step 7: Run UI contract and lint**

```powershell
node scripts/__tests__/accounting-ui-contract.test.js
npm run lint
```

Expected: contract passes and lint completes without interactive setup.

- [ ] **Step 8: Commit Next.js daybook page**

```powershell
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" add lib/api/endpoints.ts types/accounting.ts components/finance/accounting/accounting-nav.tsx "app/(dashboard)/finance/accounting/daybook/page.tsx" components/finance/accounting/daybook-client.tsx scripts/__tests__/accounting-ui-contract.test.js
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" commit -m "feat: add accounting daybook workspace"
```

## Task 5: Next.js Setup Wizard And Mapping Health UI

**Files:**

- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\accounting.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\accounting-setup-client.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\accounting-ui-contract.test.js`

- [ ] **Step 1: Add contract assertions**

Assert the setup client contains:

```javascript
assertFileContains("components/finance/accounting/accounting-setup-client.tsx", "Core mappings");
assertFileContains("components/finance/accounting/accounting-setup-client.tsx", "Non-blocking mappings");
assertFileContains("components/finance/accounting/accounting-setup-client.tsx", "Repair setup");
assertFileContains("components/finance/accounting/accounting-setup-client.tsx", "Chart of accounts");
```

- [ ] **Step 2: Extend setup status type**

Add:

```typescript
blocking_core_mapping_keys: string[];
non_blocking_mapping_keys: string[];
```

to `AccountingSetupStatus`.

- [ ] **Step 3: Replace raw setup cards with guided checklist**

In `AccountingSetupClient`, add a responsive checklist section:

- COA seed status;
- core mappings;
- non-blocking mappings;
- opening balances;
- drawer policies;
- settlement instruments.

Each row should use:

```tsx
<div className="flex items-start justify-between gap-3 rounded-md border p-3">
  <div>
    <div className="font-medium">Core mappings</div>
    <div className="text-sm text-muted-foreground">
      Required accounts for drawer cash, main cash, bank, sales, tax, refunds, variance, and Suspense.
    </div>
  </div>
  <Badge variant={missingCoreMappings ? "destructive" : "default"}>
    {missingCoreMappings ? "Blocked" : "Ready"}
  </Badge>
</div>
```

- [ ] **Step 4: Add direct links**

Add action buttons:

- `Chart of accounts` -> `/finance/accounting/chart-of-accounts`
- `Ledger mappings` -> `/finance/accounting/ledger-mapping`
- `Daybook` -> `/finance/accounting/daybook`
- `Settlements` -> `/finance/accounting/settlements`

- [ ] **Step 5: Verify UI contract and lint**

```powershell
node scripts/__tests__/accounting-ui-contract.test.js
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit setup wizard UI**

```powershell
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" add types/accounting.ts components/finance/accounting/accounting-setup-client.tsx scripts/__tests__/accounting-ui-contract.test.js
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" commit -m "feat: guide accounting setup health"
```

## Task 6: Next.js Drawer Settlement UI

**Files:**

- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\day-close.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\day-close\drawer-count-dialog.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\day-close\drawer-session-panel.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\day-close-control-ui-contract.test.js`

- [ ] **Step 1: Add day-close control contract assertions**

Assert:

```javascript
assertFileContains("components/day-close/drawer-count-dialog.tsx", "Settlement decision");
assertFileContains("components/day-close/drawer-count-dialog.tsx", "Retained float");
assertFileContains("components/day-close/drawer-count-dialog.tsx", "Pending bank deposit");
assertFileContains("components/day-close/drawer-count-dialog.tsx", "Transfer to safe");
```

- [ ] **Step 2: Add endpoint and types**

Add:

```typescript
settlementDecision: (sessionId: number) => `/drawer-sessions/${sessionId}/settlement-decision`,
```

to `DrawerSessionApis`.

Add settlement fields to `DrawerSession` in `types/day-close.ts`:

```typescript
settlement_mode?: string | null;
settlement_amount?: number | null;
settlement_destination?: string | null;
settlement_reference?: string | null;
```

- [ ] **Step 3: Extend close dialog**

In `DrawerCountDialog`, after closing count succeeds, show a settlement decision panel for closed or variance-review sessions:

- retained float input;
- settlement mode segmented buttons:
  - `Transfer to safe`
  - `Pending bank deposit`
  - `Immediate bank deposit`
  - `Retain all`
- settlement amount input;
- destination/reference input;
- reason input;
- submit button calling `DrawerSessionApis.settlementDecision(session.id)`.

- [ ] **Step 4: Keep mobile layout clean**

Use a single-column grid by default and `md:grid-cols-2` for larger screens. The dialog must keep actions visible with a sticky footer when content scrolls.

- [ ] **Step 5: Verify UI contract and lint**

```powershell
node scripts/__tests__/day-close-control-ui-contract.test.js
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit drawer settlement UI**

```powershell
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" add lib/api/endpoints.ts types/day-close.ts components/day-close/drawer-count-dialog.tsx components/day-close/drawer-session-panel.tsx scripts/__tests__/day-close-control-ui-contract.test.js
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" commit -m "feat: add drawer settlement decision UI"
```

## Task 7: End-To-End Web Validation

**Files:**

- Create: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\docs\superpowers\verification\2026-06-19-cash-control-accounting-validation.md`
- Modify only if verification exposes a bug: files from previous tasks.

- [ ] **Step 1: Run backend focused tests**

Run:

```powershell
pytest C:\yummy_backend\tests\finance\test_accounting_daybook_spec.py C:\yummy_backend\tests\finance\test_drawer_settlement_decision_spec.py C:\yummy_backend\tests\finance\test_accounting_setup_core_mapping_spec.py C:\yummy_backend\tests\finance\test_day_close_accounting_review_spec.py -q
```

Expected: all selected backend tests pass.

- [ ] **Step 2: Run Next.js static checks**

Run:

```powershell
cd "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs"
node scripts/__tests__/accounting-ui-contract.test.js
node scripts/__tests__/day-close-control-ui-contract.test.js
npm run lint
npm run build
```

Expected: contract tests, lint, and build pass.

- [ ] **Step 3: Start backend and web**

Use the existing local commands for this environment:

```powershell
cd C:\yummy_backend
$env:DEBUG='True'
uvicorn app.main:app --reload --port 8000
```

In another PowerShell:

```powershell
cd "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs"
npm run dev
```

Expected: backend available on `http://127.0.0.1:8000`; web available on `http://localhost:3000`.

- [ ] **Step 4: Validate web flow manually**

Record evidence for:

1. `/finance/accounting/setup` shows guided setup and mapping health.
2. COA setup can repair missing defaults without deleting existing accounts.
3. Drawer can be opened from the day-close flow.
4. Cash movement appears in the drawer panel.
5. Drawer close requires count and settlement decision.
6. `/finance/accounting/daybook` shows Cash Control, Payment Instruments, Transfers, Ledger Impact, and Exceptions.
7. `/finance/accounting/day-closes` shows accounting review state and blockers.
8. `/finance/accounting/settlements` still handles card/digital settlement.
9. Existing day-close history and exports remain accessible.

- [ ] **Step 5: Write verification note**

Create `docs/superpowers/verification/2026-06-19-cash-control-accounting-validation.md`:

```markdown
# Cash Control Accounting Validation

## Backend

- Command: `pytest tests/finance/test_accounting_daybook_spec.py tests/finance/test_drawer_settlement_decision_spec.py tests/finance/test_accounting_setup_core_mapping_spec.py tests/finance/test_day_close_accounting_review_spec.py -q`
- Result: passing

## Next.js

- Command: `node scripts/__tests__/accounting-ui-contract.test.js`
- Result: passing
- Command: `node scripts/__tests__/day-close-control-ui-contract.test.js`
- Result: passing
- Command: `npm run lint`
- Result: passing
- Command: `npm run build`
- Result: passing

## Manual Web Flow

- Setup health: verified
- Drawer open: verified
- Drawer close settlement decision: verified
- Daybook tabs: verified
- Day-close accounting review: verified
- Existing history/export access: verified

## Notes

- Flutter was not changed.
- Full inventory valuation remains outside this phase.
```

- [ ] **Step 6: Commit verification**

```powershell
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" add docs/superpowers/verification/2026-06-19-cash-control-accounting-validation.md
git -C "C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs" commit -m "docs: verify cash control accounting flow"
```

## Final Acceptance

The work is complete only when:

- Backend daybook endpoint exists and is tested.
- Drawer close settlement decision exists and is tested.
- Setup health separates blocking core mappings from non-blocking mapping gaps.
- Next.js has a clean responsive daybook page.
- Next.js setup screen guides users through COA and mapping health.
- Drawer close UI requires settlement decision.
- Existing day close, accounting, drawer, payment instrument, and inventory data remain accessible.
- All listed backend tests pass.
- Next.js contract tests, lint, and build pass.
- Manual web validation is documented.
- No Flutter files are changed.

