# Accountant-Friendly Accounting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accountant-friendly accounting workflow with clearer overview structure, shared report filters, editable ledger mappings, and an actionable suspense/mapping exception resolver.

**Architecture:** Keep the accounting engine ledger-backed and event-driven. Add metadata and audit support around ledger mappings, then improve the Next.js UI using reusable accounting vocabulary, filters, setup tables, and exception resolution components. Mapping changes affect future postings only; existing posted journals are corrected through vouchers or reversal/repost flows.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic in `C:\yummy_backend`; Next.js App Router + TypeScript + existing shadcn-style UI components in `yummy-desktop-nextjs`; backend tests with `pytest`; frontend contract tests with Node test runner and TypeScript.

---

## File Structure

### Backend

- Modify: `C:\yummy_backend\app\models\accounting_model.py`
  - Add mapping audit model if missing.
  - Add optional mapping metadata fields if not already present.
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
  - Add mapping create/update fields for notes, label, active status, and audit reads.
  - Add exception resolver request/response schemas.
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
  - Add mapping validation and audit logging.
  - Preserve future-only mapping changes.
  - Add exception resolver helpers.
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
  - Expose mapping create/update/audit endpoints.
  - Expose create-mapping-from-exception endpoint.
- Create: `C:\yummy_backend\migrations\versions\20260613_accounting_mapping_audit.py`
  - Add audit table and metadata columns.
- Test: `C:\yummy_backend\tests\finance\test_accounting_mapping_management_spec.py`
  - Cover mapping edits, audit trail, exception resolver, and unknown-method guardrails.

### Frontend

- Create: `lib/accounting-event-labels.ts`
  - Human labels and explanations for finance event types.
- Modify: `lib/api/endpoints.ts`
  - Add mapping audit and exception resolver endpoints.
- Modify: `types/accounting.ts`
  - Add mapping metadata/audit/resolver types.
- Modify: `components/finance/accounting/financial-report-filters.tsx`
  - Add presets, reset, active filter summary, business line, report basis, and station dropdown support.
- Modify: `components/finance/accounting/accounting-overview-client.tsx`
  - Rework layout into health, actions, grouped report tiles, exceptions, and trial balance.
- Modify: `components/finance/accounting/accounting-nav.tsx`
  - Group navigation by Overview, Reports, Setup, Controls.
- Modify: `components/finance/accounting/accounting-master-data-client.tsx`
  - Add search/filter/actions for accounts and mappings.
- Modify: `components/finance/accounting/ledger-mapping-table.tsx`
  - Add human labels, search, edit action, active status, and warning copy.
- Create: `components/finance/accounting/ledger-mapping-dialog.tsx`
  - Create/edit mapping form.
- Create: `components/finance/accounting/mapping-exception-resolver.tsx`
  - Action queue for suspense/mapping exceptions.
- Test: `scripts/__tests__/accounting-ui-contract.test.js`
  - Add contract checks for labels, filters, mapping editor, and exception resolver.

---

## Task 1: Add Accounting Event Vocabulary

**Files:**
- Create: `lib/accounting-event-labels.ts`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write the failing frontend contract test**

Add this test to `scripts/__tests__/accounting-ui-contract.test.js`:

```js
test("accounting event labels explain system event types in accountant language", () => {
  const source = read("lib/accounting-event-labels.ts");

  for (const token of [
    "ACCOUNTING_EVENT_LABELS",
    "inventory_cash_outflow",
    "Inventory purchase paid",
    "supplier_payable_created",
    "Supplier payable created",
    "collection_received",
    "Payment collected",
    "mappingPriorityHelp",
  ]) {
    assert.match(source, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: failure because `lib/accounting-event-labels.ts` does not exist or does not export the required labels.

- [ ] **Step 3: Create accounting event label helper**

Create `lib/accounting-event-labels.ts`:

```ts
export type AccountingEventLabel = {
  label: string;
  meaning: string;
  defaultDebitHint: string;
  defaultCreditHint: string;
};

export const ACCOUNTING_EVENT_LABELS: Record<string, AccountingEventLabel> = {
  sale_recognized: {
    label: "Sale recognized",
    meaning: "Food, beverage, room, or service revenue earned by a completed bill.",
    defaultDebitHint: "Customer Receivables",
    defaultCreditHint: "Sales Revenue",
  },
  collection_received: {
    label: "Payment collected",
    meaning: "Cash, card, QR, or digital payment received from a customer.",
    defaultDebitHint: "Cash or Payment Clearing",
    defaultCreditHint: "Customer Receivables",
  },
  refund_processed: {
    label: "Refund paid",
    meaning: "Money returned to the customer against a previous successful payment.",
    defaultDebitHint: "Sales Returns",
    defaultCreditHint: "Cash or Payment Clearing",
  },
  refund_liability_created: {
    label: "Refund liability created",
    meaning: "Customer is owed money but cash has not been paid out yet.",
    defaultDebitHint: "Sales Returns",
    defaultCreditHint: "Refund Liabilities",
  },
  manual_income_received: {
    label: "Manual income received",
    meaning: "Non-order income entered manually.",
    defaultDebitHint: "Cash or Payment Clearing",
    defaultCreditHint: "Manual Income",
  },
  manual_expense_paid: {
    label: "Operating expense paid",
    meaning: "Non-inventory operating cost paid by the restaurant.",
    defaultDebitHint: "Operating Expenses",
    defaultCreditHint: "Cash or Payment Clearing",
  },
  inventory_asset_acquired: {
    label: "Inventory asset acquired",
    meaning: "Inventory value added to stock before it becomes COGS.",
    defaultDebitHint: "Inventory Asset",
    defaultCreditHint: "Supplier Payables",
  },
  inventory_cash_outflow: {
    label: "Inventory purchase paid",
    meaning: "Cash, card, QR, or digital payment made to a supplier for inventory.",
    defaultDebitHint: "Supplier Payables",
    defaultCreditHint: "Cash or Payment Clearing",
  },
  inventory_cogs_recognized: {
    label: "Inventory COGS recognized",
    meaning: "Inventory cost moved into expense when stock is consumed, wasted, or adjusted.",
    defaultDebitHint: "Cost of Goods Sold",
    defaultCreditHint: "Inventory Asset",
  },
  supplier_payable_created: {
    label: "Supplier payable created",
    meaning: "Unpaid supplier bill for inventory or purchase received.",
    defaultDebitHint: "Inventory Asset or Expense",
    defaultCreditHint: "Supplier Payables",
  },
  supplier_payment_made: {
    label: "Supplier payment made",
    meaning: "Payment made against an existing supplier payable.",
    defaultDebitHint: "Supplier Payables",
    defaultCreditHint: "Cash or Payment Clearing",
  },
  discount_applied: {
    label: "Discount applied",
    meaning: "Discount reducing sales revenue.",
    defaultDebitHint: "Discount Contra Revenue",
    defaultCreditHint: "Customer Receivables",
  },
  cash_variance_recorded: {
    label: "Cash variance recorded",
    meaning: "Cash drawer overage or shortage from day close.",
    defaultDebitHint: "Cash Over/Short",
    defaultCreditHint: "Cash",
  },
};

export function accountingEventLabel(eventType: string): AccountingEventLabel {
  return ACCOUNTING_EVENT_LABELS[eventType] || {
    label: eventType.replace(/_/g, " "),
    meaning: "No accountant-facing explanation has been configured for this finance event.",
    defaultDebitHint: "Select debit account",
    defaultCreditHint: "Select credit account",
  };
}

export const mappingPriorityHelp =
  "Mappings resolve by exact event + payment method + business line first, then event + payment method, then event default, then Suspense.";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: PASS for the new event-label contract.

- [ ] **Step 5: Commit**

```powershell
git add lib/accounting-event-labels.ts scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: add accountant-facing event labels"
```

---

## Task 2: Add Mapping Audit Schema

**Files:**
- Modify: `C:\yummy_backend\app\models\accounting_model.py`
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Create: `C:\yummy_backend\migrations\versions\20260613_accounting_mapping_audit.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_mapping_management_spec.py`

- [ ] **Step 1: Write failing model/schema test**

Create `C:\yummy_backend\tests\finance\test_accounting_mapping_management_spec.py`:

```python
from datetime import datetime, timezone


def test_ledger_mapping_model_supports_accountant_metadata_and_audit():
    from app.models.accounting_model import LedgerMapping, LedgerMappingAudit
    from app.schema.accounting_schema import LedgerMappingAuditRead, LedgerMappingUpdate

    mapping_columns = set(LedgerMapping.__table__.columns.keys())
    audit_columns = set(LedgerMappingAudit.__table__.columns.keys())

    assert {"label", "description", "is_active", "updated_by_id", "updated_at"}.issubset(mapping_columns)
    assert {
        "id",
        "restaurant_id",
        "mapping_id",
        "changed_by_id",
        "changed_at",
        "old_debit_account_id",
        "old_credit_account_id",
        "new_debit_account_id",
        "new_credit_account_id",
        "reason",
    }.issubset(audit_columns)
    assert "reason" in LedgerMappingUpdate.model_fields
    assert "changed_at" in LedgerMappingAuditRead.model_fields
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_ledger_mapping_model_supports_accountant_metadata_and_audit -q
```

Expected: FAIL because `LedgerMappingAudit` or mapping metadata fields are missing.

- [ ] **Step 3: Add model fields**

In `C:\yummy_backend\app\models\accounting_model.py`, add fields to `LedgerMapping`:

```python
    label = Column(String(160), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

Add a new model near `LedgerMapping`:

```python
class LedgerMappingAudit(Base):
    __tablename__ = "ledger_mapping_audits"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    mapping_id = Column(Integer, ForeignKey("ledger_mappings.id", ondelete="SET NULL"), nullable=True, index=True)
    changed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    old_debit_account_id = Column(Integer, ForeignKey("chart_accounts.id", ondelete="SET NULL"), nullable=True)
    old_credit_account_id = Column(Integer, ForeignKey("chart_accounts.id", ondelete="SET NULL"), nullable=True)
    new_debit_account_id = Column(Integer, ForeignKey("chart_accounts.id", ondelete="SET NULL"), nullable=True)
    new_credit_account_id = Column(Integer, ForeignKey("chart_accounts.id", ondelete="SET NULL"), nullable=True)
    old_label = Column(String(160), nullable=True)
    new_label = Column(String(160), nullable=True)
    old_description = Column(Text, nullable=True)
    new_description = Column(Text, nullable=True)
    old_is_active = Column(Boolean, nullable=True)
    new_is_active = Column(Boolean, nullable=True)
    reason = Column(Text, nullable=True)

    mapping = relationship("LedgerMapping")
```

- [ ] **Step 4: Add schema fields**

In `C:\yummy_backend\app\schema\accounting_schema.py`, extend mapping schemas:

```python
class LedgerMappingCreate(BaseModel):
    restaurant_id: int
    event_type: str
    payment_method: Optional[str] = None
    business_line: str = "restaurant"
    debit_account_id: int
    credit_account_id: int
    label: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    reason: Optional[str] = None


class LedgerMappingUpdate(BaseModel):
    event_type: Optional[str] = None
    payment_method: Optional[str] = None
    business_line: Optional[str] = None
    debit_account_id: Optional[int] = None
    credit_account_id: Optional[int] = None
    label: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    reason: Optional[str] = None
```

Add read schema:

```python
class LedgerMappingAuditRead(BaseModel):
    id: int
    restaurant_id: int
    mapping_id: Optional[int] = None
    changed_by_id: Optional[int] = None
    changed_at: datetime
    old_debit_account_id: Optional[int] = None
    old_credit_account_id: Optional[int] = None
    new_debit_account_id: Optional[int] = None
    new_credit_account_id: Optional[int] = None
    old_label: Optional[str] = None
    new_label: Optional[str] = None
    old_description: Optional[str] = None
    new_description: Optional[str] = None
    old_is_active: Optional[bool] = None
    new_is_active: Optional[bool] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True
```

Extend `LedgerMappingRead` with:

```python
    label: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    updated_by_id: Optional[int] = None
    updated_at: Optional[datetime] = None
```

- [ ] **Step 5: Add migration**

Create `C:\yummy_backend\migrations\versions\20260613_accounting_mapping_audit.py`:

```python
"""accounting mapping audit

Revision ID: 20260613_accounting_mapping_audit
Revises: 20260612_expense_payment_method_fonepay
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa


revision = "20260613_accounting_mapping_audit"
down_revision = "20260612_expense_payment_method_fonepay"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ledger_mappings", sa.Column("label", sa.String(length=160), nullable=True))
    op.add_column("ledger_mappings", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("ledger_mappings", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("ledger_mappings", sa.Column("updated_by_id", sa.Integer(), nullable=True))
    op.add_column("ledger_mappings", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
    op.create_foreign_key("fk_ledger_mappings_updated_by", "ledger_mappings", "users", ["updated_by_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "ledger_mapping_audits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("mapping_id", sa.Integer(), nullable=True),
        sa.Column("changed_by_id", sa.Integer(), nullable=True),
        sa.Column("changed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("old_debit_account_id", sa.Integer(), nullable=True),
        sa.Column("old_credit_account_id", sa.Integer(), nullable=True),
        sa.Column("new_debit_account_id", sa.Integer(), nullable=True),
        sa.Column("new_credit_account_id", sa.Integer(), nullable=True),
        sa.Column("old_label", sa.String(length=160), nullable=True),
        sa.Column("new_label", sa.String(length=160), nullable=True),
        sa.Column("old_description", sa.Text(), nullable=True),
        sa.Column("new_description", sa.Text(), nullable=True),
        sa.Column("old_is_active", sa.Boolean(), nullable=True),
        sa.Column("new_is_active", sa.Boolean(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mapping_id"], ["ledger_mappings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["old_debit_account_id"], ["chart_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["old_credit_account_id"], ["chart_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_debit_account_id"], ["chart_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_credit_account_id"], ["chart_accounts.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_ledger_mapping_audits_restaurant_id", "ledger_mapping_audits", ["restaurant_id"])
    op.create_index("ix_ledger_mapping_audits_mapping_id", "ledger_mapping_audits", ["mapping_id"])


def downgrade():
    op.drop_index("ix_ledger_mapping_audits_mapping_id", table_name="ledger_mapping_audits")
    op.drop_index("ix_ledger_mapping_audits_restaurant_id", table_name="ledger_mapping_audits")
    op.drop_table("ledger_mapping_audits")
    op.drop_constraint("fk_ledger_mappings_updated_by", "ledger_mappings", type_="foreignkey")
    op.drop_column("ledger_mappings", "updated_at")
    op.drop_column("ledger_mappings", "updated_by_id")
    op.drop_column("ledger_mappings", "is_active")
    op.drop_column("ledger_mappings", "description")
    op.drop_column("ledger_mappings", "label")
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_ledger_mapping_model_supports_accountant_metadata_and_audit -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd C:\yummy_backend
git add app\models\accounting_model.py app\schema\accounting_schema.py migrations\versions\20260613_accounting_mapping_audit.py tests\finance\test_accounting_mapping_management_spec.py
git commit -m "feat: add accounting mapping audit schema"
```

---

## Task 3: Implement Safe Mapping Create/Update and Audit Logging

**Files:**
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_mapping_management_spec.py`

- [ ] **Step 1: Add failing service test**

Append to `test_accounting_mapping_management_spec.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_mapping_update_records_audit_and_does_not_repost_existing_journal(db, test_restaurant):
    from datetime import date
    from decimal import Decimal
    from sqlalchemy import func, select

    from app.models.accounting_model import Account, JournalEntry, JournalLine, LedgerMapping, LedgerMappingAudit
    from app.schema.accounting_schema import LedgerMappingUpdate
    from app.schema.finance_schema import FinanceEventCreate
    from app.services.accounting_service import AccountingMasterDataService, AccountingPostingService
    from app.services.finance_event_service import FinanceEventService

    posting = AccountingPostingService(db)
    accounts = await posting.ensure_default_chart(test_restaurant.id)
    await posting.ensure_default_mappings(test_restaurant.id, accounts)
    await FinanceEventService(db).record_event(
        FinanceEventCreate(
            event_key="mapping-audit-collection",
            restaurant_id=test_restaurant.id,
            business_line="restaurant",
            event_type="collection_received",
            source_type="test",
            source_id=1,
            event_at=date(2026, 6, 13),
            business_date=date(2026, 6, 13),
            financial_date=date(2026, 6, 13),
            amount=Decimal("100.00"),
            direction="inflow",
            payment_method="cash",
        ),
        post_to_accounting=False,
    )
    await posting.post_finance_events(restaurant_id=test_restaurant.id, date_from=date(2026, 6, 13), date_to=date(2026, 6, 13))

    cash_mapping = await db.scalar(
        select(LedgerMapping).where(
            LedgerMapping.restaurant_id == test_restaurant.id,
            LedgerMapping.event_type == "collection_received",
            LedgerMapping.payment_method == "cash",
        )
    )
    card_account = accounts["1010"]

    await AccountingMasterDataService(db).update_mapping(
        cash_mapping.id,
        LedgerMappingUpdate(
            credit_account_id=card_account.id,
            label="Cash collection custom",
            reason="Test audit record",
        ),
        restaurant_id=test_restaurant.id,
        actor_id=7,
    )

    audit_count = await db.scalar(
        select(func.count()).select_from(LedgerMappingAudit).where(
            LedgerMappingAudit.mapping_id == cash_mapping.id,
            LedgerMappingAudit.changed_by_id == 7,
        )
    )
    journal_count = await db.scalar(
        select(func.count()).select_from(JournalEntry).where(
            JournalEntry.restaurant_id == test_restaurant.id,
            JournalEntry.source_key == "mapping-audit-collection",
        )
    )
    old_cash_debit = await db.scalar(
        select(func.coalesce(func.sum(JournalLine.debit), 0))
        .join(Account, Account.id == JournalLine.account_id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(Account.code == "1000", JournalEntry.restaurant_id == test_restaurant.id)
    )

    assert audit_count == 1
    assert journal_count == 1
    assert old_cash_debit == Decimal("100.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_mapping_update_records_audit_and_does_not_repost_existing_journal -q
```

Expected: FAIL because `update_mapping` does not accept `actor_id` or write audit rows.

- [ ] **Step 3: Implement audit logging in service**

In `AccountingMasterDataService.update_mapping`, change signature:

```python
async def update_mapping(
    self,
    mapping_id: int,
    payload: LedgerMappingUpdate,
    *,
    restaurant_id: int,
    actor_id: Optional[int] = None,
) -> LedgerMapping:
```

Before mutating fields, capture old values and add audit:

```python
from app.models.accounting_model import LedgerMappingAudit

old_debit = mapping.debit_account_id
old_credit = mapping.credit_account_id
old_label = mapping.label
old_description = mapping.description
old_is_active = mapping.is_active

fields = payload.model_dump(exclude_unset=True)
reason = fields.pop("reason", None)
for key, value in fields.items():
    setattr(mapping, key, value)
mapping.updated_by_id = actor_id

self.db.add(
    LedgerMappingAudit(
        restaurant_id=restaurant_id,
        mapping_id=mapping.id,
        changed_by_id=actor_id,
        old_debit_account_id=old_debit,
        old_credit_account_id=old_credit,
        new_debit_account_id=mapping.debit_account_id,
        new_credit_account_id=mapping.credit_account_id,
        old_label=old_label,
        new_label=mapping.label,
        old_description=old_description,
        new_description=mapping.description,
        old_is_active=old_is_active,
        new_is_active=mapping.is_active,
        reason=reason,
    )
)
await self.db.flush()
return await self._require_mapping(mapping.id, restaurant_id)
```

- [ ] **Step 4: Pass actor id from controller**

In `accounting_controller.update_mapping`, pass current user id:

```python
mapping = await AccountingMasterDataService(db).update_mapping(
    mapping_id,
    payload,
    restaurant_id=restaurant_id,
    actor_id=_current_user_id(current_user),
)
```

If `_current_user_id` is not imported in that section, use the existing helper already used by voucher/reversal endpoints in the same controller.

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_mapping_update_records_audit_and_does_not_repost_existing_journal -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
cd C:\yummy_backend
git add app\services\accounting_service.py app\controller\accounting_controller.py tests\finance\test_accounting_mapping_management_spec.py
git commit -m "feat: audit accounting mapping changes"
```

---

## Task 4: Add Shared Accountant Report Filters

**Files:**
- Modify: `components/finance/accounting/financial-report-filters.tsx`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

Add:

```js
test("accounting report filters expose presets reset scope and report basis", () => {
  const source = read("components/finance/accounting/financial-report-filters.tsx");

  for (const token of [
    "DATE_PRESETS",
    "Today",
    "This Month",
    "Last Month",
    "onReset",
    "businessLine",
    "reportBasis",
    "Active scope",
    "Reset filters",
  ]) {
    assert.match(source, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: FAIL because shared filters do not expose presets/reset/report basis.

- [ ] **Step 3: Extend filter component props**

In `financial-report-filters.tsx`, add:

```ts
type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom" },
];
```

Extend props:

```ts
  businessLine?: string;
  onBusinessLineChange?: (value: string) => void;
  reportBasis?: "posted_journals" | "finance_events" | "both";
  onReportBasisChange?: (value: "posted_journals" | "finance_events" | "both") => void;
  datePreset?: DatePreset;
  onDatePresetChange?: (value: DatePreset) => void;
  onReset?: () => void;
```

- [ ] **Step 4: Add active scope and reset UI**

Inside the component, compute:

```ts
const activeScope = `${dateFrom} to ${dateTo} | ${businessLine || "restaurant"} | ${station || "All stations"} | ${
  reportBasis === "finance_events" ? "Finance events" : reportBasis === "both" ? "Both" : "Posted journals"
}`;
```

Render a compact top line:

```tsx
<div className="flex flex-col gap-2 border-y border-border bg-background px-4 py-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active scope</div>
      <div className="text-sm font-medium text-foreground">{activeScope}</div>
    </div>
    {onReset && (
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset filters
      </Button>
    )}
  </div>
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div className="flex flex-wrap items-end gap-3">
      <Select value={datePreset || "custom"} onValueChange={(value) => onDatePresetChange?.(value as DatePreset)}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input id="accounting-date-from" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="h-9 w-[150px]" />
      <Input id="accounting-date-to" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className="h-9 w-[150px]" />
      {onBusinessLineChange && (
        <Select value={businessLine || "restaurant"} onValueChange={onBusinessLineChange}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {actions}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
        Refresh
      </Button>
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} disabled={exportDisabled}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: both pass.

- [ ] **Step 6: Commit**

```powershell
git add components/finance/accounting/financial-report-filters.tsx scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: improve accounting report filters"
```

---

## Task 5: Redesign Accounting Overview Information Architecture

**Files:**
- Modify: `components/finance/accounting/accounting-overview-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

Add:

```js
test("accounting overview groups accountant workflows by purpose", () => {
  const overview = read("components/finance/accounting/accounting-overview-client.tsx");
  const nav = read("components/finance/accounting/accounting-nav.tsx");

  for (const token of [
    "Accounting health",
    "Daily controls",
    "Financial statements",
    "People ledgers",
    "Setup",
    "Resolve Exceptions",
    "Create Voucher",
    "Open Reports",
  ]) {
    assert.match(overview, new RegExp(token));
  }

  for (const token of ["Overview", "Reports", "Setup", "Controls"]) {
    assert.match(nav, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: FAIL because overview/nav are not grouped this way.

- [ ] **Step 3: Add grouped shortcut data**

In `accounting-overview-client.tsx`, add:

```ts
const accountingShortcutGroups = [
  {
    title: "Daily controls",
    items: [
      { label: "Trial Balance", href: "/finance/accounting/trial-balance", description: "Check debit and credit balance." },
      { label: "General Ledger", href: "/finance/accounting/general-ledger", description: "Review journal lines by account." },
      { label: "Cash Flow", href: "/finance/accounting/cash-flow", description: "Track inflows and outflows." },
    ],
  },
  {
    title: "Financial statements",
    items: [
      { label: "Profit & Loss", href: "/finance/accounting/profit-loss", description: "Revenue, costs, and profit." },
      { label: "Balance Sheet", href: "/finance/accounting/balance-sheet", description: "Assets, liabilities, and equity." },
      { label: "VAT Summary", href: "/finance/accounting/vat-summary", description: "Taxable sales and tax payable." },
    ],
  },
  {
    title: "People ledgers",
    items: [
      { label: "Customer Ledger", href: "/finance/accounting/customer-ledger", description: "Customer receivables activity." },
      { label: "Supplier Ledger", href: "/finance/accounting/supplier-ledger", description: "Supplier payable activity." },
      { label: "AR/AP Aging", href: "/finance/accounting/ar-aging", description: "Outstanding balances by age." },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Chart of Accounts", href: "/finance/accounting/chart-of-accounts", description: "Manage account structure." },
      { label: "Ledger Mappings", href: "/finance/accounting/ledger-mapping", description: "Map finance events to accounts." },
      { label: "Opening Balances", href: "/finance/accounting/opening-balances", description: "Set starting balances." },
    ],
  },
];
```

- [ ] **Step 4: Render health and shortcut sections**

Replace the current overview body ordering with:

```tsx
<section className="grid gap-3 md:grid-cols-5">
  <HealthCard title="Setup" item={accountingHealth?.accounts_seeded} />
  <HealthCard title="Mappings" item={accountingHealth?.mappings_seeded} />
  <HealthCard title="Unposted" item={accountingHealth?.unposted_finance_events} />
  <HealthCard title="Suspense" item={accountingHealth?.suspense_amount} />
  <HealthCard title="Balance" item={accountingHealth?.trial_balance_difference} />
</section>
```

Add primary actions:

```tsx
<div className="flex flex-wrap gap-2">
  <Button onClick={postFinanceEvents} disabled={posting || !canRunBackfill}>Post Events</Button>
  <Button variant="outline" onClick={runBackfillDryRun} disabled={backfillLoading || !canRunBackfill}>Dry Run Backfill</Button>
  <Link href="/finance/accounting/ledger-mapping"><Button variant="outline">Resolve Exceptions</Button></Link>
  <Link href="/finance/accounting/vouchers"><Button variant="outline">Create Voucher</Button></Link>
  <Link href="/finance/accounting/trial-balance"><Button variant="outline">Open Reports</Button></Link>
</div>
```

Add grouped cards:

```tsx
<section className="grid gap-4 xl:grid-cols-2">
  {accountingShortcutGroups.map((group) => (
    <Card key={group.title}>
      <CardHeader>
        <CardTitle className="text-base">{group.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {group.items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md border border-border p-3 hover:bg-muted/50">
            <div className="font-semibold">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.description}</div>
          </Link>
        ))}
      </CardContent>
    </Card>
  ))}
</section>
```

- [ ] **Step 5: Group navigation**

In `accounting-nav.tsx`, define navigation groups:

```ts
const navGroups = [
  { label: "Overview", items: [{ href: "/finance/accounting", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Reports",
    items: [
      { href: "/finance/accounting/trial-balance", label: "Trial Balance", icon: Scale },
      { href: "/finance/accounting/general-ledger", label: "General Ledger", icon: BookOpen },
      { href: "/finance/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { href: "/finance/accounting/balance-sheet", label: "Balance Sheet", icon: Landmark },
      { href: "/finance/accounting/cash-flow", label: "Cash Flow", icon: Wallet },
      { href: "/finance/accounting/vat-summary", label: "VAT", icon: ReceiptText },
      { href: "/finance/accounting/ar-aging", label: "AR Aging", icon: Users },
      { href: "/finance/accounting/ap-aging", label: "AP Aging", icon: Truck },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/finance/accounting/chart-of-accounts", label: "Accounts", icon: Landmark },
      { href: "/finance/accounting/ledger-mapping", label: "Mappings", icon: Map },
      { href: "/finance/accounting/opening-balances", label: "Opening Balances", icon: Database },
      { href: "/finance/accounting/periods", label: "Periods", icon: CalendarDays },
    ],
  },
  {
    label: "Controls",
    items: [
      { href: "/finance/accounting/vouchers", label: "Vouchers", icon: FilePenLine },
      { href: "/finance/accounting/settlements", label: "Settlements", icon: BadgeCheck },
      { href: "/finance/accounting/setup", label: "Setup Check", icon: Settings },
    ],
  },
];
```

Render group labels as small uppercase headings before each item set.

- [ ] **Step 6: Run tests**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add components/finance/accounting/accounting-overview-client.tsx components/finance/accounting/accounting-nav.tsx scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: reorganize accounting overview"
```

---

## Task 6: Build Editable Ledger Mapping UI

**Files:**
- Create: `components/finance/accounting/ledger-mapping-dialog.tsx`
- Modify: `components/finance/accounting/ledger-mapping-table.tsx`
- Modify: `components/finance/accounting/accounting-master-data-client.tsx`
- Modify: `lib/api/endpoints.ts`
- Modify: `types/accounting.ts`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

Add:

```js
test("ledger mapping UI supports accountant-safe manual mapping edits", () => {
  const table = read("components/finance/accounting/ledger-mapping-table.tsx");
  const dialog = read("components/finance/accounting/ledger-mapping-dialog.tsx");
  const master = read("components/finance/accounting/accounting-master-data-client.tsx");

  for (const token of [
    "accountingEventLabel",
    "Edit Mapping",
    "Mapping changes apply to future postings only",
    "reason",
    "debit_account_id",
    "credit_account_id",
    "is_active",
  ]) {
    assert.match(`${table}\n${dialog}\n${master}`, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: FAIL because dialog and edit flow do not exist.

- [ ] **Step 3: Add API endpoints**

In `lib/api/endpoints.ts`, extend `AccountingApis`:

```ts
  createMapping: () => "/accounting/mappings",
  updateMapping: (mappingId: number, restaurantId: number) =>
    `/accounting/mappings/${mappingId}?restaurant_id=${restaurantId}`,
  mappingAudit: (mappingId: number, restaurantId: number) =>
    `/accounting/mappings/${mappingId}/audit?restaurant_id=${restaurantId}`,
```

- [ ] **Step 4: Add types**

In `types/accounting.ts`, extend `LedgerMapping`:

```ts
  label?: string | null;
  description?: string | null;
  is_active?: boolean;
  updated_by_id?: number | null;
  updated_at?: string | null;
```

Add:

```ts
export type LedgerMappingPayload = {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  debit_account_id: number;
  credit_account_id: number;
  label?: string | null;
  description?: string | null;
  is_active?: boolean;
  reason?: string | null;
};
```

- [ ] **Step 5: Create mapping dialog**

Create `ledger-mapping-dialog.tsx` with props:

```ts
type LedgerMappingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  accounts: ChartAccount[];
  mapping?: LedgerMapping | null;
  onSaved: () => void;
};
```

The submit payload must include:

```ts
const payload: LedgerMappingPayload = {
  restaurant_id: restaurantId,
  event_type: form.event_type.trim(),
  payment_method: form.payment_method.trim() || null,
  business_line: form.business_line.trim() || "restaurant",
  debit_account_id: Number(form.debit_account_id),
  credit_account_id: Number(form.credit_account_id),
  label: form.label.trim() || null,
  description: form.description.trim() || null,
  is_active: form.is_active,
  reason: form.reason.trim() || "Accountant mapping update",
};
```

Use `AccountingApis.updateMapping(mapping.id, restaurantId)` for edit and `AccountingApis.createMapping()` for create.

Include this warning in the dialog:

```tsx
<div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
  Mapping changes apply to future postings only. Existing posted journals require a correction voucher or reversal/repost.
</div>
```

- [ ] **Step 6: Update table**

In `ledger-mapping-table.tsx`:

- Import `accountingEventLabel`.
- Display label and meaning above system event type.
- Add search prop and action prop:

```ts
type LedgerMappingTableProps = {
  mappings: LedgerMapping[];
  loading?: boolean;
  onEdit?: (mapping: LedgerMapping) => void;
};
```

Render edit button:

```tsx
{onEdit && (
  <Button variant="ghost" size="sm" onClick={() => onEdit(mapping)}>
    Edit Mapping
  </Button>
)}
```

- [ ] **Step 7: Wire master data client**

In `accounting-master-data-client.tsx`:

- Fetch accounts even in mapping mode.
- Add `selectedMapping` and `mappingDialogOpen` state.
- Add “New Mapping” button.
- Pass `onEdit` to `LedgerMappingTable`.
- Render `LedgerMappingDialog`.

- [ ] **Step 8: Run tests**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add components/finance/accounting/ledger-mapping-dialog.tsx components/finance/accounting/ledger-mapping-table.tsx components/finance/accounting/accounting-master-data-client.tsx lib/api/endpoints.ts types/accounting.ts scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: add editable ledger mappings"
```

---

## Task 7: Build Mapping Exception Resolver

**Files:**
- Create: `components/finance/accounting/mapping-exception-resolver.tsx`
- Modify: `components/finance/accounting/accounting-overview-client.tsx`
- Modify: `components/finance/accounting/mapping-exception-banner.tsx`
- Modify: `lib/api/endpoints.ts`
- Modify: `types/accounting.ts`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

Add:

```js
test("mapping exceptions are presented as an actionable resolver queue", () => {
  const resolver = read("components/finance/accounting/mapping-exception-resolver.tsx");
  const overview = read("components/finance/accounting/accounting-overview-client.tsx");

  for (const token of [
    "MappingExceptionResolver",
    "Create mapping for future postings",
    "Open source trace",
    "Create correction voucher",
    "Reverse and repost",
    "does not automatically fix already-posted journals",
  ]) {
    assert.match(`${resolver}\n${overview}`, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Add resolver component**

Create `mapping-exception-resolver.tsx`:

```tsx
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingEventLabel } from "@/lib/accounting-event-labels";
import type { MappingExceptionReportResponse } from "@/types/accounting";

type Props = {
  report: MappingExceptionReportResponse | null;
  onCreateMapping: (eventType: string, paymentMethod: string | null, businessLine: string) => void;
};

export function MappingExceptionResolver({ report, onCreateMapping }: Props) {
  const rows = report?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Mapping exception resolver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Creating a mapping fixes future postings only. It does not automatically fix already-posted journals.
        </p>
        {rows.map((row) => {
          const label = accountingEventLabel(row.event_type);
          return (
            <div key={`${row.event_type}-${row.payment_method}-${row.business_line}`} className="rounded-md border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold">{label.label}</div>
                  <div className="text-xs text-muted-foreground">{label.meaning}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.event_type} | {row.payment_method || "Any method"} | {row.business_line}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onCreateMapping(row.event_type, row.payment_method, row.business_line)}>
                    Create mapping for future postings
                  </Button>
                  <Button size="sm" variant="outline" disabled>
                    Open source trace
                  </Button>
                  <Link href="/finance/accounting/vouchers">
                    <Button size="sm" variant="outline">Create correction voucher</Button>
                  </Link>
                  <Button size="sm" variant="outline" disabled>
                    Reverse and repost
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Wire resolver to overview**

In `accounting-overview-client.tsx`:

- Import `MappingExceptionResolver`.
- Import `LedgerMappingDialog`.
- Fetch accounts for dialog use.
- Add `prefillMapping` state.
- Render resolver under the banner.
- When create mapping is clicked, open mapping dialog with event type/payment method/business line prefilled.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add components/finance/accounting/mapping-exception-resolver.tsx components/finance/accounting/accounting-overview-client.tsx components/finance/accounting/mapping-exception-banner.tsx lib/api/endpoints.ts types/accounting.ts scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: add mapping exception resolver"
```

---

## Task 8: Add Chart of Accounts Search and Safer Management UI

**Files:**
- Modify: `components/finance/accounting/account-table.tsx`
- Modify: `components/finance/accounting/accounting-master-data-client.tsx`
- Test: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

Add:

```js
test("chart of accounts UI supports search filters and account usage warnings", () => {
  const table = read("components/finance/accounting/account-table.tsx");
  const master = read("components/finance/accounting/accounting-master-data-client.tsx");

  for (const token of [
    "Search accounts",
    "Filter by type",
    "Suspense account",
    "Used in mappings",
    "Deactivate",
  ]) {
    assert.match(`${table}\n${master}`, new RegExp(token));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
```

Expected: FAIL because account table does not expose these controls.

- [ ] **Step 3: Add local search and type filter**

In `account-table.tsx`, add props:

```ts
type AccountTableProps = {
  accounts: ChartAccount[];
  loading?: boolean;
  search?: string;
  accountType?: string;
  onSearchChange?: (value: string) => void;
  onAccountTypeChange?: (value: string) => void;
};
```

Filter accounts:

```ts
const filteredAccounts = accounts.filter((account) => {
  const haystack = `${account.code} ${account.name}`.toLowerCase();
  const matchesSearch = !search || haystack.includes(search.toLowerCase());
  const matchesType = !accountType || accountType === "all" || account.account_type === accountType;
  return matchesSearch && matchesType;
});
```

Render controls above the table:

```tsx
<div className="flex flex-wrap gap-2 border-b p-3">
  <Input placeholder="Search accounts" value={search || ""} onChange={(event) => onSearchChange?.(event.target.value)} />
  <Select value={accountType || "all"} onValueChange={(value) => onAccountTypeChange?.(value)}>
    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All types</SelectItem>
      <SelectItem value="asset">Assets</SelectItem>
      <SelectItem value="liability">Liabilities</SelectItem>
      <SelectItem value="equity">Equity</SelectItem>
      <SelectItem value="revenue">Revenue</SelectItem>
      <SelectItem value="contra_revenue">Contra revenue</SelectItem>
      <SelectItem value="expense">Expenses</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Show account markers:

```tsx
{account.is_suspense && <Badge variant="outline">Suspense account</Badge>}
<span className="text-xs text-muted-foreground">Used in mappings</span>
<Button variant="ghost" size="sm" disabled>Deactivate</Button>
```

- [ ] **Step 4: Wire state in master data client**

Add:

```ts
const [accountSearch, setAccountSearch] = useState("");
const [accountType, setAccountType] = useState("all");
```

Pass to `AccountTable`.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add components/finance/accounting/account-table.tsx components/finance/accounting/accounting-master-data-client.tsx scripts/__tests__/accounting-ui-contract.test.js
git commit -m "feat: improve chart of accounts usability"
```

---

## Task 9: Backend Exception Resolver Endpoint

**Files:**
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_mapping_management_spec.py`

- [ ] **Step 1: Write failing resolver test**

Append:

```python
@pytest.mark.asyncio
async def test_create_mapping_from_exception_creates_future_mapping_without_touching_suspense_journal(db, test_restaurant):
    from datetime import date
    from decimal import Decimal
    from sqlalchemy import func, select

    from app.models.accounting_model import Account, JournalEntry, JournalLine, LedgerMapping
    from app.schema.accounting_schema import MappingExceptionResolveRequest
    from app.schema.finance_schema import FinanceEventCreate
    from app.services.accounting_service import AccountingExceptionResolverService, AccountingPostingService
    from app.services.finance_event_service import FinanceEventService

    posting = AccountingPostingService(db)
    accounts = await posting.ensure_default_chart(test_restaurant.id)
    await posting.ensure_default_mappings(test_restaurant.id, accounts)
    await FinanceEventService(db).record_event(
        FinanceEventCreate(
            event_key="resolver-unknown-payment",
            restaurant_id=test_restaurant.id,
            business_line="restaurant",
            event_type="inventory_cash_outflow",
            source_type="test",
            source_id=1,
            event_at=date(2026, 6, 13),
            business_date=date(2026, 6, 13),
            financial_date=date(2026, 6, 13),
            amount=Decimal("75.00"),
            direction="outflow",
            payment_method="wallet_x",
        ),
        post_to_accounting=False,
    )
    await posting.post_finance_events(restaurant_id=test_restaurant.id, date_from=date(2026, 6, 13), date_to=date(2026, 6, 13))

    mapping = await AccountingExceptionResolverService(db).create_mapping_from_exception(
        MappingExceptionResolveRequest(
            restaurant_id=test_restaurant.id,
            event_type="inventory_cash_outflow",
            payment_method="wallet_x",
            business_line="restaurant",
            debit_account_id=accounts["2000"].id,
            credit_account_id=accounts["1020"].id,
            label="Wallet X inventory settlement",
            reason="Resolve Wallet X supplier payments",
        ),
        actor_id=9,
    )
    suspense_debit = await db.scalar(
        select(func.coalesce(func.sum(JournalLine.debit), 0))
        .join(Account, Account.id == JournalLine.account_id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(Account.code == "9999", JournalEntry.restaurant_id == test_restaurant.id)
    )
    saved = await db.scalar(select(LedgerMapping).where(LedgerMapping.id == mapping.id))

    assert saved.payment_method == "wallet_x"
    assert saved.debit_account_id == accounts["2000"].id
    assert saved.credit_account_id == accounts["1020"].id
    assert suspense_debit == Decimal("75.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_create_mapping_from_exception_creates_future_mapping_without_touching_suspense_journal -q
```

Expected: FAIL because resolver schema/service does not exist.

- [ ] **Step 3: Add resolver schema**

In `accounting_schema.py`:

```python
class MappingExceptionResolveRequest(BaseModel):
    restaurant_id: int
    event_type: str
    payment_method: Optional[str] = None
    business_line: str = "restaurant"
    debit_account_id: int
    credit_account_id: int
    label: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
```

- [ ] **Step 4: Add resolver service**

In `accounting_service.py`:

```python
class AccountingExceptionResolverService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_mapping_from_exception(self, payload: MappingExceptionResolveRequest, *, actor_id: Optional[int] = None) -> LedgerMapping:
        create = LedgerMappingCreate(
            restaurant_id=payload.restaurant_id,
            event_type=payload.event_type,
            payment_method=payload.payment_method,
            business_line=payload.business_line or "restaurant",
            debit_account_id=payload.debit_account_id,
            credit_account_id=payload.credit_account_id,
            label=payload.label,
            description=payload.description or "Created from mapping exception resolver.",
            is_active=True,
            reason=payload.reason or "Created from mapping exception resolver.",
        )
        mapping = await AccountingMasterDataService(self.db).create_mapping(create, actor_id=actor_id)
        return mapping
```

Update `AccountingMasterDataService.create_mapping` to accept `actor_id` and write an audit row with old values as `None`.

- [ ] **Step 5: Add endpoint**

In `accounting_controller.py`:

```python
@router.post(
    "/mapping-exceptions/resolve",
    response_model=BaseResponse[LedgerMappingRead],
    dependencies=[Depends(require_permission("finance.accounting.mappings.manage"))],
)
async def resolve_mapping_exception(
    payload: MappingExceptionResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    mapping = await AccountingExceptionResolverService(db).create_mapping_from_exception(
        payload,
        actor_id=_current_user_id(current_user),
    )
    return BaseResponse(status="success", message="Mapping created for future postings", data=_mapping_read(mapping))
```

- [ ] **Step 6: Run test**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_management_spec.py::test_create_mapping_from_exception_creates_future_mapping_without_touching_suspense_journal -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd C:\yummy_backend
git add app\schema\accounting_schema.py app\services\accounting_service.py app\controller\accounting_controller.py tests\finance\test_accounting_mapping_management_spec.py
git commit -m "feat: resolve accounting mapping exceptions"
```

---

## Task 10: Full Verification

**Files:**
- Verify backend and frontend only.

- [ ] **Step 1: Run backend accounting tests**

Run:

```powershell
cd C:\yummy_backend
.\venv\Scripts\python.exe -m pytest tests\finance -q
```

Expected: all finance/accounting tests pass.

- [ ] **Step 2: Run frontend accounting contract tests**

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node --test scripts\__tests__\accounting-ui-contract.test.js
node --test scripts\__tests__\finance-reporting-ui-contract.test.js
```

Expected: all contract tests pass.

- [ ] **Step 3: Run TypeScript**

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
npx tsc --noEmit --pretty false
```

Expected: exit code 0.

- [ ] **Step 4: Build frontend if Next config is non-interactive**

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
npm run build
```

Expected: build succeeds. If blocked by existing lint/setup prompt, record the exact prompt and continue with TypeScript plus contract tests as the verified frontend baseline.

- [ ] **Step 5: Manual UI checks**

Open the app and verify:

- Accounting overview shows health strip and grouped report cards.
- Filters show active scope and reset button.
- Ledger mappings show human labels and meanings.
- Ledger mapping edit dialog warns that changes affect future postings only.
- Mapping exceptions show resolver actions.
- Creating a mapping from an exception does not remove existing suspense until a correction or reversal is performed.

- [ ] **Step 6: Commit verification notes**

If verification required small fixes, commit them:

```powershell
git add .
git commit -m "test: verify accountant-friendly accounting module"
```

If there were no additional changes, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Accounting overview: Task 5.
  - Shared filters: Task 4.
  - Manual mappings: Tasks 2, 3, 6.
  - Exception resolver: Tasks 7 and 9.
  - Chart of accounts usability: Task 8.
  - Audit and future-only mapping changes: Tasks 2, 3, 9.
  - Verification: Task 10.
- Scope control:
  - Station-level mapping is deliberately excluded.
  - Mapping approval workflow is excluded from this first plan.
  - Existing journal correction is exposed as voucher/reversal guidance; automatic historical rewrite is excluded.
- Test coverage:
  - Backend behavior tests for audit and exception mapping.
  - Frontend contract tests for layout, labels, filters, and dialogs.
  - TypeScript verification.
