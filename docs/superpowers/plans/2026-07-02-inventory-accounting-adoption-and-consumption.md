# Inventory Accounting Adoption and Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inventory operationally simple when accounting is disabled, add accountant-controlled inventory profiles and adoption when accounting is enabled, and provide reliable manual and automatic consumption across backend, Next.js, and Flutter.

**Architecture:** The backend is the sole authority for effective inventory treatment. Focused policy, adoption, and consumption services resolve profile snapshots and emit finance events, while web and Flutter operational forms stop asking users accounting questions. Existing quantities remain unchanged; legacy accounting ambiguity is exposed through an adoption audit and resolved prospectively with an opening valuation.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, PostgreSQL, pytest, Next.js/TypeScript/React, Flutter/Dart/BLoC.

---

## File Structure

### Backend

- Modify `migrations/versions/20260702_inventory_accounting_treatment.py`: stage the existing adjustment treatment column and classify old rows as `legacy_unclassified` unless evidence proves a treatment.
- Create `migrations/versions/20260702_inventory_accounting_profiles.py`: profile, assignment, adoption, and consumption-batch schema.
- Modify `app/models/inventory_model.py`: profile, adoption, adoption-line, and consumption-batch models plus item/profile references and operational/book cost separation.
- Modify `app/models/__init__.py`: export the new inventory accounting models.
- Modify `app/schema/inventory_schema.py`: profile, policy, adoption, consumption, and valuation DTOs.
- Create `app/services/inventory_accounting_policy_service.py`: feature-gated profile resolution and reclassification validation.
- Create `app/services/inventory_accounting_adoption_service.py`: legacy audit, adoption draft, opening valuation, and posting lifecycle.
- Create `app/services/inventory_consumption_service.py`: manual batch consumption and shared movement/event creation.
- Modify `app/services/inventory_service.py`: remove request-selected treatment as authority and delegate profile resolution and consumption posting.
- Modify `app/services/accounting_service.py`: choose accounts from immutable profile snapshots.
- Modify `app/services/accounting_setup_service.py`: seed standard inventory profiles and expose inventory accounting health.
- Modify `app/controller/inventory_controller.py`: operational consumption routes and permission checks.
- Modify `app/controller/accounting_controller.py`: accountant profile/adoption/report routes.
- Modify `app/utils/permission_catalog.py`: inventory accounting and consumption permissions plus role presets.
- Modify `app/main.py`: register no schema workaround; only import/export additions if required.
- Create `tests/finance/test_inventory_accounting_policy_spec.py`.
- Create `tests/finance/test_inventory_accounting_adoption_spec.py`.
- Create `tests/finance/test_inventory_consumption_spec.py`.
- Modify `tests/finance/test_inventory_valuation_accounting_spec.py`.
- Modify `tests/finance/test_manual_cash_drawer_attribution.py`.

### Next.js

- Modify `app/(dashboard)/inventory/page.tsx`: remove treatment selectors and add dedicated Consume action.
- Create `components/inventory/inventory-consumption-dialog.tsx`: responsive multi-line consumption workspace.
- Create `app/(dashboard)/finance/accounting/inventory/page.tsx`: accountant inventory route.
- Create `components/finance/accounting/inventory-accounting-client.tsx`: profiles, assignments, adoption, valuation, and exceptions.
- Modify `components/finance/accounting/accounting-nav.tsx`: add Inventory Accounting navigation.
- Modify `lib/api/endpoints.ts`: inventory accounting and consumption endpoints.
- Modify `types/accounting.ts`: profile, adoption, audit, and consumption types.
- Modify `lib/role-permissions.ts`: new permission labels/defaults.
- Modify `scripts/__tests__/accounting-ui-contract.test.js`: accountant workspace contracts.
- Create `scripts/__tests__/inventory-operational-ui-contract.test.js`: hidden accounting selector and consume-flow contracts.

### Flutter

- Delete `lib/features/inventory/presentation/widgets/inventory_accounting_treatment_selector.dart`.
- Modify inventory item, restock, and adjustment forms to remove treatment controls.
- Create `lib/features/inventory/data/models/inventory_consumption_model.dart`.
- Create `lib/features/inventory/domain/entities/inventory_consumption_entity.dart`.
- Create `lib/features/inventory/domain/usecases/consume_inventory_usecase.dart`.
- Modify inventory data source/repository contracts and implementation for batch consumption.
- Modify inventory BLoC event/state/handler files for preview and submission.
- Create `lib/features/inventory/presentation/screens/inventory_consume_screen.dart`.
- Modify `lib/features/inventory/presentation/screens/inventory_list_screen.dart`: expose Receive, Consume, Count, Waste, Return, and History actions.
- Modify `lib/core/utils/role_permissions.dart` and role permission descriptions.
- Create `test/features/inventory/inventory_consumption_model_test.dart`.
- Create `test/features/inventory/inventory_consumption_bloc_test.dart`.

---

### Task 1: Repair Local Alembic Branch State

**Files:**
- Modify: `C:/yummy_backend/migrations/versions/20260702_inventory_accounting_treatment.py`
- Database: local PostgreSQL configured by `C:/yummy_backend/.env`

- [ ] **Step 1: Back up revision and feature-flag state**

Run a PostgreSQL transaction that creates a durable temporary repair table:

```sql
DROP TABLE IF EXISTS migration_backup_finance_flags_20260702;
CREATE TABLE migration_backup_finance_flags_20260702 AS
SELECT id, finance_reports_enabled, finance_accounting_enabled
FROM restaurant_info;
```

Expected: one backup row per restaurant and no changes to `restaurant_info`.

- [ ] **Step 2: Verify the physically applied attendance branch**

Run schema checks for all six attendance restaurant columns, fourteen attendance-entry columns, five attendance-device columns, eleven attendance tables, latitude/longitude, `attendance.payroll.export`, and `uq_attendance_entries_one_open_staff`.

Expected local counts: `6, 14, 5, 11, 2, 1, 1`.

- [ ] **Step 3: Restore both actual branch revisions**

Replace the incorrect single revision row only after Step 2 succeeds:

```sql
BEGIN;
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num)
VALUES ('e6e682ef9b71'), ('20260625_restaurant_location');
COMMIT;
```

Expected: two revision rows representing the finance and attendance branch positions.

- [ ] **Step 4: Make the pending treatment migration legacy-safe**

Change the migration to add `accounting_treatment` as nullable, classify rows with explicit event metadata, assign all other existing rows `legacy_unclassified`, then enforce non-null:

```python
op.add_column(
    "inventory_adjustments",
    sa.Column("accounting_treatment", sa.String(length=40), nullable=True),
)
op.execute("""
UPDATE inventory_adjustments AS adjustment
SET accounting_treatment = COALESCE(
    event.metadata_json->>'accounting_treatment',
    'legacy_unclassified'
)
FROM finance_events AS event
WHERE event.source_type = 'inventory_adjustment'
  AND event.source_id = adjustment.id
""")
op.execute("""
UPDATE inventory_adjustments
SET accounting_treatment = 'legacy_unclassified'
WHERE accounting_treatment IS NULL
""")
op.alter_column("inventory_adjustments", "accounting_treatment", nullable=False)
```

- [ ] **Step 5: Upgrade to head and restore flags**

Run:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m alembic upgrade head
```

Then restore preserved feature flags and drop the repair table:

```sql
UPDATE restaurant_info AS restaurant
SET finance_reports_enabled = backup.finance_reports_enabled,
    finance_accounting_enabled = backup.finance_accounting_enabled
FROM migration_backup_finance_flags_20260702 AS backup
WHERE backup.id = restaurant.id;
DROP TABLE migration_backup_finance_flags_20260702;
```

- [ ] **Step 6: Verify migration repair**

Run `alembic current`, `alembic heads`, and physical checks for the treatment column, payment-bank rename, finance defaults, and seven station indexes.

Expected: one current/head revision and no missing inventory column.

- [ ] **Step 7: Commit the migration repair**

```powershell
git add migrations/versions/20260702_inventory_accounting_treatment.py
git commit -m "fix: preserve legacy inventory treatment during migration"
```

### Task 2: Add Inventory Accounting Profiles And Snapshot Schema

**Files:**
- Create: `C:/yummy_backend/migrations/versions/20260702_inventory_accounting_profiles.py`
- Modify: `C:/yummy_backend/app/models/inventory_model.py`
- Modify: `C:/yummy_backend/app/models/__init__.py`
- Modify: `C:/yummy_backend/app/schema/inventory_schema.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_accounting_policy_spec.py`

- [ ] **Step 1: Write failing model/schema tests**

Add tests asserting profile treatment validation and read-only legacy treatment:

```python
def test_new_purchase_rejects_legacy_unclassified_treatment():
    with pytest.raises(ValidationError):
        InventoryAdjustmentCreate(
            adjustment_type="add",
            quantity=Decimal("1"),
            cost=Decimal("100"),
            accounting_treatment="legacy_unclassified",
        )


def test_profile_requires_accounts_for_capitalized_treatment():
    with pytest.raises(ValidationError):
        InventoryAccountingProfileCreate(
            restaurant_id=52,
            name="Food Stock",
            treatment="inventory_asset",
            inventory_asset_account_id=None,
            cogs_account_id=None,
        )
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_inventory_accounting_policy_spec.py -q --tb=short
```

Expected: import/model failures because profile DTOs do not exist.

- [ ] **Step 3: Add profile and snapshot models**

Add `InventoryAccountingProfile` with account foreign keys and add these item/adjustment fields:

```python
class InventoryAccountingTreatment(str, enum.Enum):
    inventory_asset = "inventory_asset"
    direct_expense = "direct_expense"


class InventoryLegacyTreatment(str, enum.Enum):
    legacy_unclassified = "legacy_unclassified"
```

Persist `accounting_profile_id`, `accounting_profile_name_snapshot`,
`accounting_treatment`, `operational_unit_cost_snapshot`, and
`book_unit_cost_snapshot` on the relevant item/adjustment/movement records.

- [ ] **Step 4: Add the profile migration**

Create the profile table, account foreign keys, unique restaurant/name constraint,
one-default-per-restaurant partial index, item profile reference, and snapshot columns.
Use `20260702_inventory_accounting_treatment` as `down_revision`.

- [ ] **Step 5: Run model tests and migration on a clean test database**

Expected: profile validation tests pass and Alembic reports one head.

- [ ] **Step 6: Commit profile schema**

```powershell
git add migrations/versions/20260702_inventory_accounting_profiles.py app/models/inventory_model.py app/models/__init__.py app/schema/inventory_schema.py tests/finance/test_inventory_accounting_policy_spec.py
git commit -m "feat: add inventory accounting profiles"
```

### Task 3: Enforce Feature-Gated Treatment Resolution

**Files:**
- Create: `C:/yummy_backend/app/services/inventory_accounting_policy_service.py`
- Modify: `C:/yummy_backend/app/services/inventory_service.py`
- Modify: `C:/yummy_backend/app/controller/inventory_controller.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_accounting_policy_spec.py`

- [ ] **Step 1: Add failing resolution tests**

Cover these exact cases:

```python
@pytest.mark.asyncio
async def test_disabled_restaurant_forces_direct_expense(policy_service):
    resolved = await policy_service.resolve_for_item(restaurant_id=52, item_id=10)
    assert resolved.treatment == "direct_expense"
    assert resolved.profile_id is None


@pytest.mark.asyncio
async def test_enabled_restaurant_uses_item_profile(policy_service):
    resolved = await policy_service.resolve_for_item(restaurant_id=52, item_id=10)
    assert resolved.treatment == "inventory_asset"
    assert resolved.profile_name == "Food Stock"
```

- [ ] **Step 2: Implement one resolver**

Define:

```python
@dataclass(frozen=True)
class ResolvedInventoryAccountingPolicy:
    treatment: str
    profile_id: int | None
    profile_name: str
    inventory_asset_account_id: int | None
    cogs_account_id: int | None
    direct_expense_account_id: int | None
    wastage_account_id: int | None
    variance_account_id: int | None
```

`resolve_for_item()` must load `Restaurant.finance_accounting_enabled`, force direct
expense when false, otherwise use item profile, restaurant default, then standard
setup profile.

- [ ] **Step 3: Remove client authority**

Stop passing request-selected treatment into purchase posting. Store the resolver
result as the immutable adjustment/event snapshot. Reject a supplied treatment from
users lacking `inventory.accounting.manage`; accept no `legacy_unclassified` value.

- [ ] **Step 4: Preserve cash drawer attribution**

Run and extend `test_manual_cash_drawer_attribution.py` so both treatments reduce
expected drawer cash once for a paid cash purchase.

- [ ] **Step 5: Run focused tests**

Expected: policy and drawer tests pass.

- [ ] **Step 6: Commit resolver changes**

```powershell
git add app/services/inventory_accounting_policy_service.py app/services/inventory_service.py app/controller/inventory_controller.py tests/finance/test_inventory_accounting_policy_spec.py tests/finance/test_manual_cash_drawer_attribution.py
git commit -m "feat: resolve inventory treatment from restaurant policy"
```

### Task 4: Separate Operational Cost From Book Value

**Files:**
- Modify: `C:/yummy_backend/app/models/inventory_model.py`
- Modify: `C:/yummy_backend/app/repositories/inventory_repository.py`
- Modify: `C:/yummy_backend/app/services/inventory_service.py`
- Modify: `C:/yummy_backend/app/schema/inventory_schema.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_valuation_accounting_spec.py`

- [ ] **Step 1: Add failing mixed-cost tests**

```python
@pytest.mark.asyncio
async def test_direct_expense_updates_operational_cost_not_book_value(service):
    result = await receive(service, treatment="direct_expense", qty="10", cost="500")
    assert result.operational_unit_cost == Decimal("50.00")
    assert result.book_unit_cost == Decimal("0.00")


@pytest.mark.asyncio
async def test_capitalized_purchase_updates_weighted_book_value(service):
    result = await receive(service, treatment="inventory_asset", qty="10", cost="500")
    assert result.book_unit_cost == Decimal("50.00")
```

- [ ] **Step 2: Implement independent cost updates**

Operational cost uses the latest or weighted supplier cost according to the existing
UI contract. Book value changes only for capitalized receipts and decreases from
capitalized consumption/wastage/variance.

- [ ] **Step 3: Update valuation responses**

Return explicitly named fields:

```python
operational_unit_cost: Decimal
book_unit_cost: Decimal
book_value: Decimal
```

Keep `cost_per_unit` as a deprecated compatibility alias for operational cost until
both clients are migrated.

- [ ] **Step 4: Run valuation tests**

Expected: no double expense and no book value from direct-expensed receipts.

- [ ] **Step 5: Commit cost separation**

```powershell
git add app/models/inventory_model.py app/repositories/inventory_repository.py app/services/inventory_service.py app/schema/inventory_schema.py tests/finance/test_inventory_valuation_accounting_spec.py
git commit -m "feat: separate inventory operating cost and book value"
```

### Task 5: Post Journals From Profile Snapshots

**Files:**
- Modify: `C:/yummy_backend/app/services/accounting_service.py`
- Modify: `C:/yummy_backend/app/services/accounting_setup_service.py`
- Modify: `C:/yummy_backend/app/services/finance_reporting_service.py`
- Modify: `C:/yummy_backend/app/services/accounting_daybook_service.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_accounting_policy_spec.py`

- [ ] **Step 1: Add failing journal tests**

Assert paid/unpaid direct expense, capitalized receipt, COGS, wastage, and variance
debit/credit accounts from event profile snapshots.

- [ ] **Step 2: Seed standard profiles during accounting setup**

Use existing default accounts for Inventory Asset, COGS, Direct Food Purchases,
Inventory Wastage, and Inventory Variance. Do not expose raw account selection to
ordinary inventory endpoints.

- [ ] **Step 3: Resolve posting accounts from event snapshots**

Posting must read snapshot account IDs from event metadata. A later profile edit must
not change an older event's journal.

- [ ] **Step 4: Expose accounting health**

Add blocked health checks for missing default profile, missing capitalized accounts,
and capitalized items without profiles.

- [ ] **Step 5: Run accounting tests**

Expected: every journal balances and direct-expensed consumption creates no journal.

- [ ] **Step 6: Commit posting changes**

```powershell
git add app/services/accounting_service.py app/services/accounting_setup_service.py app/services/finance_reporting_service.py app/services/accounting_daybook_service.py tests/finance/test_inventory_accounting_policy_spec.py
git commit -m "feat: post inventory journals from profile snapshots"
```

### Task 6: Add Inventory Adoption And Legacy Audit

**Files:**
- Create: `C:/yummy_backend/app/services/inventory_accounting_adoption_service.py`
- Modify: `C:/yummy_backend/app/models/inventory_model.py`
- Modify: `C:/yummy_backend/app/schema/inventory_schema.py`
- Modify: `C:/yummy_backend/app/controller/accounting_controller.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_accounting_adoption_spec.py`

- [ ] **Step 1: Write failing adoption lifecycle tests**

Cover draft creation, current quantity snapshot, direct-expense zero value, balanced
opening journal, immutable posted adoption, and legacy duplicate-risk classification.

- [ ] **Step 2: Add adoption models and migration tables**

Persist status (`draft`, `ready`, `posted`, `cancelled`), activation timestamp,
profile/item snapshots, quantity, unit book value, total book value, review actor, and
opening-balance reference.

- [ ] **Step 3: Implement preview and post methods**

Define:

```python
async def create_draft(self, restaurant_id: int, activation_at: datetime, actor_id: int): ...
async def update_line(self, adoption_id: int, item_id: int, profile_id: int, unit_book_value: Decimal): ...
async def preview(self, adoption_id: int): ...
async def post(self, adoption_id: int, actor_id: int): ...
```

Posting creates one opening inventory entry and locks the snapshot.

- [ ] **Step 4: Implement legacy audit categories**

Return `already_accounted`, `reliable_unposted`, `duplicate_risk`, and
`legacy_unclassified`. Do not auto-post any category.

- [ ] **Step 5: Add permission-gated accounting routes**

Use `inventory.accounting.view` for reads and `inventory.accounting.manage` for
profile/adoption writes.

- [ ] **Step 6: Run adoption tests and commit**

```powershell
git add app/services/inventory_accounting_adoption_service.py app/models/inventory_model.py app/schema/inventory_schema.py app/controller/accounting_controller.py tests/finance/test_inventory_accounting_adoption_spec.py
git commit -m "feat: add inventory accounting adoption lifecycle"
```

### Task 7: Add Atomic Manual Consumption

**Files:**
- Create: `C:/yummy_backend/app/services/inventory_consumption_service.py`
- Modify: `C:/yummy_backend/app/controller/inventory_controller.py`
- Modify: `C:/yummy_backend/app/schema/inventory_schema.py`
- Modify: `C:/yummy_backend/app/services/inventory_service.py`
- Test: `C:/yummy_backend/tests/finance/test_inventory_consumption_spec.py`

- [ ] **Step 1: Write failing batch tests**

```python
@pytest.mark.asyncio
async def test_manual_batch_is_atomic(service):
    with pytest.raises(InsufficientStockError):
        await service.consume(batch_with_one_valid_and_one_invalid_line)
    assert await movement_count() == 0


@pytest.mark.asyncio
async def test_direct_expensed_consumption_has_no_cogs(service):
    result = await service.consume(direct_expense_batch)
    assert result.cogs_total == Decimal("0.00")
```

- [ ] **Step 2: Add request/response DTOs**

Use a client idempotency key, purpose enum, optional note, and one or more positive
quantity lines. Return before/after quantities, warnings, and COGS preview.

- [ ] **Step 3: Implement preview and submit**

Lock all item rows in stable ID order, validate every line, then write movements and
events in one transaction. Reject manual negative stock without override permission.

- [ ] **Step 4: Route automatic consumption through shared posting helpers**

Keep the existing production trigger but ensure the source key uniquely includes KOT,
item, recipe link, and restoration state.

- [ ] **Step 5: Run consumption tests and commit**

```powershell
git add app/services/inventory_consumption_service.py app/controller/inventory_controller.py app/schema/inventory_schema.py app/services/inventory_service.py tests/finance/test_inventory_consumption_spec.py
git commit -m "feat: add atomic inventory consumption batches"
```

### Task 8: Add Permission Catalog And Presets

**Files:**
- Modify: `C:/yummy_backend/app/utils/permission_catalog.py`
- Modify: `C:/yummy_backend/app/utils/permissions.py`
- Modify: `C:/yummy_backend/scripts/sync_permissions.py`
- Test: `C:/yummy_backend/tests/permission_guard_regressions_spec.py`

- [ ] **Step 1: Add failing preset tests**

Assert accountant/accounting approver receive inventory accounting permissions,
manager/admin receive consume permission, and cashier receives none of the new write
permissions unless explicitly assigned.

- [ ] **Step 2: Add catalog entries and implications**

Seed the four permissions from the design and make legacy `inventory.manage` imply
operational stock permissions but not accountant policy management.

- [ ] **Step 3: Run permission synchronization and tests**

Expected: sync is idempotent and permission regression tests pass.

- [ ] **Step 4: Commit permissions**

```powershell
git add app/utils/permission_catalog.py app/utils/permissions.py scripts/sync_permissions.py tests/permission_guard_regressions_spec.py
git commit -m "feat: add inventory accounting and consumption permissions"
```

### Task 9: Simplify Next.js Inventory And Add Consumption UI

**Files:**
- Modify: `app/(dashboard)/inventory/page.tsx`
- Create: `components/inventory/inventory-consumption-dialog.tsx`
- Modify: `lib/api/endpoints.ts`
- Create: `scripts/__tests__/inventory-operational-ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract tests**

Assert the operational inventory page has no `Accounting treatment`, `Expense now`,
or `Stock value` strings and includes `Consume stock` plus the consumption endpoint.

- [ ] **Step 2: Remove treatment state and payload fields**

Delete `ACCOUNTING_TREATMENT_OPTIONS`, treatment form state, selector rendering, and
client-side treatment payload construction.

- [ ] **Step 3: Add the multi-line consumption dialog**

Use item search, stable line rows, quantity/unit inputs, purpose select, note, preview,
negative-stock warning, and one submit button. Keep dimensions stable and responsive.

- [ ] **Step 4: Refresh authoritative inventory and valuation after submit**

Do not calculate final balances in the browser. Refetch inventory, valuation, and
ledger data after the backend accepts the batch.

- [ ] **Step 5: Run contracts, TypeScript, and lint**

```powershell
node scripts\__tests__\inventory-operational-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

- [ ] **Step 6: Commit operational web UI**

```powershell
git add -- 'app/(dashboard)/inventory/page.tsx' 'components/inventory/inventory-consumption-dialog.tsx' 'lib/api/endpoints.ts' 'scripts/__tests__/inventory-operational-ui-contract.test.js'
git commit -m "feat: simplify inventory receiving and add consumption"
```

### Task 10: Add Next.js Accountant Inventory Workspace

**Files:**
- Create: `app/(dashboard)/finance/accounting/inventory/page.tsx`
- Create: `components/finance/accounting/inventory-accounting-client.tsx`
- Modify: `components/finance/accounting/accounting-nav.tsx`
- Modify: `types/accounting.ts`
- Modify: `lib/api/endpoints.ts`
- Modify: `lib/role-permissions.ts`
- Modify: `scripts/__tests__/accounting-ui-contract.test.js`

- [ ] **Step 1: Add failing accounting contracts**

Assert the route, profile controls, adoption lifecycle, legacy audit, valuation totals,
source trace, and permission keys exist.

- [ ] **Step 2: Implement the route and client**

Use tabs for Health, Profiles, Item assignments, Adoption, Valuation, and Exceptions.
Keep normal states dense and table-oriented; use dialogs only for profile editing and
posting confirmation.

- [ ] **Step 3: Add activation safeguards**

Disable posting until all capitalized lines have profiles/values, totals balance, and
the user confirms the activation date. Show direct-expense items separately with zero
book value.

- [ ] **Step 4: Add navigation and role labels**

Only show the route when accounting is enabled and the user has
`inventory.accounting.view`.

- [ ] **Step 5: Run web verification and commit**

```powershell
node scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit
npm run lint
git add -- 'app/(dashboard)/finance/accounting/inventory/page.tsx' 'components/finance/accounting/inventory-accounting-client.tsx' 'components/finance/accounting/accounting-nav.tsx' 'types/accounting.ts' 'lib/api/endpoints.ts' 'lib/role-permissions.ts' 'scripts/__tests__/accounting-ui-contract.test.js'
git commit -m "feat: add inventory accounting workspace"
```

### Task 11: Simplify Flutter Inventory Operations

**Files:**
- Delete: `lib/features/inventory/presentation/widgets/inventory_accounting_treatment_selector.dart`
- Modify: `lib/features/inventory/presentation/screens/inventory_item_form_screen.dart`
- Modify: `lib/features/inventory/presentation/screens/inventory_restock_screen.dart`
- Modify: `lib/features/inventory/presentation/widgets/inventory_adjustment_form.dart`
- Modify: `lib/features/inventory/data/datasources/inventory_remote_data_source.dart`
- Modify: `lib/features/inventory/data/repositories/inventory_repository_impl.dart`
- Modify: `lib/features/inventory/domain/repositories/inventory_repository.dart`
- Modify: `lib/features/inventory/domain/usecases/create_inventory_item_usecase.dart`
- Modify: `lib/features/inventory/domain/usecases/adjust_inventory_usecase.dart`
- Modify: `lib/features/inventory/presentation/bloc/inventory_event.dart`
- Modify: `lib/features/inventory/presentation/bloc/inventory_bloc.dart`

- [ ] **Step 1: Add/update widget and request tests**

Assert create/restock/adjust payloads omit treatment fields and no operational widget
renders accounting terminology.

- [ ] **Step 2: Remove treatment controls and parameters**

Delete selector imports/state and let the backend derive treatment. Preserve quantity,
cost, supplier, payment, instrument, drawer, and note behavior.

- [ ] **Step 3: Run formatter, targeted tests, and analysis**

```powershell
dart format lib\features\inventory test\features\inventory
flutter test test\features\inventory --reporter compact
flutter analyze --no-fatal-infos lib\features\inventory test\features\inventory
```

- [ ] **Step 4: Commit simplified Flutter forms**

```powershell
git add lib/features/inventory test/features/inventory
git commit -m "feat: simplify mobile inventory receiving"
```

### Task 12: Add Flutter Consumption Parity

**Files:**
- Create: `lib/features/inventory/data/models/inventory_consumption_model.dart`
- Create: `lib/features/inventory/domain/entities/inventory_consumption_entity.dart`
- Create: `lib/features/inventory/domain/usecases/consume_inventory_usecase.dart`
- Create: `lib/features/inventory/presentation/screens/inventory_consume_screen.dart`
- Modify: `lib/features/inventory/data/datasources/inventory_remote_data_source.dart`
- Modify: `lib/features/inventory/data/repositories/inventory_repository_impl.dart`
- Modify: `lib/features/inventory/domain/repositories/inventory_repository.dart`
- Modify: `lib/features/inventory/presentation/bloc/inventory_event.dart`
- Modify: `lib/features/inventory/presentation/bloc/inventory_state.dart`
- Modify: `lib/features/inventory/presentation/bloc/inventory_bloc.dart`
- Modify: `lib/features/inventory/presentation/screens/inventory_list_screen.dart`
- Modify: `lib/core/utils/role_permissions.dart`
- Modify: `lib/features/roles/presentation/utils/permission_descriptions.dart`
- Test: `test/features/inventory/inventory_consumption_model_test.dart`
- Test: `test/features/inventory/inventory_consumption_bloc_test.dart`

- [ ] **Step 1: Write failing model and BLoC tests**

Assert JSON keys `idempotency_key`, `purpose`, `note`, and `lines`; assert preview,
submit, success refresh, and validation failure state transitions.

- [ ] **Step 2: Add domain/data contracts**

Create immutable line, request, preview, and result types. Repository methods are:

```dart
Future<InventoryConsumptionPreview> previewConsumption(InventoryConsumptionRequest request);
Future<InventoryConsumptionResult> consumeInventory(InventoryConsumptionRequest request);
```

- [ ] **Step 3: Add BLoC events and handlers**

Use separate preview and submit events, ignore stale preview responses, and refresh
inventory/low-stock state after success.

- [ ] **Step 4: Build the consumption screen**

Implement searchable multi-line item entry, unit labels, purpose selection, optional
note, preview totals, negative warnings, and stable submit controls.

- [ ] **Step 5: Gate the action by permission**

Show Consume only with `inventory.consume`; allow negative override UI only with
`inventory.negative_stock.override`.

- [ ] **Step 6: Run Flutter verification and commit**

```powershell
dart format lib\features\inventory lib\core\utils\role_permissions.dart test\features\inventory
flutter test test\features\inventory --reporter compact
flutter analyze --no-fatal-infos lib\features\inventory test\features\inventory
git add lib/features/inventory lib/core/utils/role_permissions.dart test/features/inventory
git commit -m "feat: add mobile inventory consumption"
```

### Task 13: Cross-System Verification

**Files:**
- Modify only files required by failures attributable to this implementation.

- [ ] **Step 1: Run backend focused suite**

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_inventory_accounting_policy_spec.py tests\finance\test_inventory_accounting_adoption_spec.py tests\finance\test_inventory_consumption_spec.py tests\finance\test_inventory_valuation_accounting_spec.py tests\finance\test_manual_cash_drawer_attribution.py tests\permission_guard_regressions_spec.py -q --tb=short --disable-warnings
```

Expected: all focused tests pass.

- [ ] **Step 2: Run backend compile and migration checks**

```powershell
venv\Scripts\python.exe -m compileall -q app
venv\Scripts\python.exe -m alembic current
venv\Scripts\python.exe -m alembic heads
```

Expected: compile succeeds and current equals the single head.

- [ ] **Step 3: Run Next.js checks**

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\inventory-operational-ui-contract.test.js
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

Expected: contracts and TypeScript pass; lint exits zero with only documented existing warnings.

- [ ] **Step 4: Run Flutter checks**

```powershell
cd "C:\flutter applications\yummy"
flutter test test\features\inventory test\features\drawer_session test\features\finance --reporter compact
flutter analyze --no-fatal-infos lib\features\inventory test\features\inventory
```

Expected: tests pass and analysis has no errors or warnings in touched code.

- [ ] **Step 5: Run live smoke flow**

Verify disabled-accounting direct expense, enabled-accounting capitalized receipt,
cash drawer reduction, direct-expensed consume with no COGS, capitalized consume with
COGS, adoption preview/post, and legacy exception visibility on web and Flutter.

- [ ] **Step 6: Review diffs and preserve unrelated work**

Run `git diff --check` in all three repositories. Do not revert pre-existing dirty
files or unrelated user changes.

---

## Completion Conditions

- The local database is at one Alembic head and inventory endpoints return successfully.
- Accounting-disabled restaurants never see or choose inventory treatment.
- Accounting-enabled treatment comes from accountant-managed profiles.
- Existing stock quantities are unchanged and legacy ambiguity is explicit.
- Opening inventory adoption is reviewed and immutable after posting.
- Direct-expensed stock never creates duplicate COGS.
- Paid cash inventory reduces the correct drawer exactly once.
- Manual consumption is atomic and available on web and Flutter.
- Focused backend, Next.js, and Flutter verification passes.
