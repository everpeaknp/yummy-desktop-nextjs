# Inventory Accounting Adoption and Consumption Design

## Status

Approved for implementation on 2026-07-02.

## Scope

This design covers the Yummy backend, Next.js management application, and Flutter
application. It simplifies inventory for restaurants that do not use accounting,
adds accountant-controlled inventory valuation for restaurants that do, introduces
an explicit inventory adoption flow, and makes stock consumption easier to record.

It also defines the repair for the current local Alembic branch drift that prevents
the inventory treatment migration from being applied.

## Goals

1. Normal inventory users must not make accounting decisions while receiving stock.
2. Restaurants without accounting enabled must treat inventory purchases as direct
   operating expenses without showing an accounting-treatment field.
3. Accounting-enabled restaurants must capitalize only items configured for stock
   valuation and recognize their cost through consumption, wastage, or variance.
4. Existing stock quantities and history must be preserved without inventing
   historical values or duplicating expenses.
5. Accountants must be able to review inventory policies, mappings, adoption status,
   valuation, COGS, wastage, and unresolved legacy records.
6. Cash-paid inventory purchases must reduce the correct active drawer regardless of
   whether the purchase is expensed immediately or capitalized.
7. Manual and automatic consumption must be auditable, idempotent, unit-aware, and
   easy to use on web and Flutter.

## Non-Goals

- Rewriting historical stock quantities.
- Automatically revaluing historical stock from incomplete purchase records.
- Letting ordinary stock users choose debit and credit accounts.
- Replacing the existing recipe-to-inventory links.
- Implementing lot, batch, expiry, or FIFO valuation in this phase.

## Core Rules

### Accounting Disabled

The backend is authoritative. When `finance_accounting_enabled` is false:

- every new inventory purchase resolves to `direct_expense`;
- clients do not show or submit an accounting-treatment choice;
- paid purchases create one direct-expense finance event and the corresponding cash,
  card, digital, or Fonepay outflow;
- unpaid purchases create a direct-expense supplier payable;
- consumption and wastage reduce quantity but do not create COGS or another expense;
- accounting valuation is not presented as a book value.

Operational purchase-cost information may still be retained for supplier comparison
and recipe costing, but it must not be treated as inventory book value.

### Accounting Enabled

When `finance_accounting_enabled` is true, treatment is resolved from an accountant-
managed inventory accounting profile assigned to the item.

Resolution order:

1. assigned active item profile;
2. restaurant default profile;
3. standard `Stocked Ingredient` profile created by accounting setup.

Normal receive-stock forms still do not show an accounting-treatment field.
Treatment is derived by the backend and stored as an immutable snapshot on the
purchase adjustment and finance event.

### No Casual Per-Purchase Override

Per-purchase treatment overrides are not part of normal stock receiving. They make a
single weighted-average pool contain conflicting accounting policies and make later
COGS difficult to explain.

An accountant changes an item's profile prospectively. A profile change while the
item has non-zero valued stock requires an audited reclassification action with a
reason. It must never silently rewrite earlier movements.

## Accounting Profiles

Add restaurant-scoped inventory accounting profiles with:

- name;
- treatment: `inventory_asset` or `direct_expense`;
- inventory asset account for capitalized profiles;
- COGS account for capitalized profiles;
- direct purchase expense account for direct-expense profiles;
- wastage account;
- inventory variance account;
- active flag;
- default flag;
- created/updated actor and timestamps.

`inventory_items` receives an optional `accounting_profile_id`. A null value means
the restaurant default profile applies.

Accounting setup creates at least:

- `Stocked Ingredient`: Inventory Asset -> COGS;
- `Direct Supply Expense`: Direct Food/Supply Purchase Expense with no later COGS.

The accountant may create profiles such as Beverage Stock, Food Stock, Packaging
Expense, and Cleaning Expense without exposing ledger accounts to stock receivers.

## Permissions

Add these permissions and include them in the appropriate default role presets:

- `inventory.accounting.view`: inspect inventory accounting profiles, valuation,
  adoption, and exceptions;
- `inventory.accounting.manage`: create profiles, assign items, change the default,
  and perform reclassification;
- `inventory.consume`: record manual consumption;
- `inventory.negative_stock.override`: authorize manual consumption below zero stock.

`inventory.stock.manage` continues to control receiving, counting, returns, and
wastage. It does not grant accounting-policy access.

Accountant and accounting-approver presets receive inventory accounting permissions.
Manager/admin presets receive operational inventory permissions. A restaurant may
combine them through custom roles.

## Purchase Data Flow

1. The client submits quantity, total cost, supplier, payment status, payment method,
   and drawer session when required.
2. The backend loads the restaurant feature flags and resolves the effective profile.
3. The backend stores the resolved treatment and profile ID as adjustment snapshots.
4. Quantity and stock movement are recorded in the same database transaction.
5. Paid cash purchases resolve the authorized active drawer and create a drawer cash-
   out movement.
6. The finance event is created with item, profile, treatment, supplier, payment
   instrument, drawer session, and source metadata.
7. Accounting posting uses the profile snapshot, not the item's current profile.

For `direct_expense`:

- paid: Debit Direct Purchase Expense, Credit payment account;
- unpaid: Debit Direct Purchase Expense, Credit Supplier Payable;
- later supplier payment: Debit Supplier Payable, Credit payment account.

For `inventory_asset`:

- receipt: Debit Inventory Asset, Credit Supplier Payable or payment account;
- consumption: Debit COGS, Credit Inventory Asset;
- wastage: Debit Wastage Expense, Credit Inventory Asset;
- shortage variance: Debit Inventory Variance, Credit Inventory Asset;
- overage variance: Debit Inventory Asset, Credit Inventory Variance.

No flow may create both a direct purchase expense and COGS for the same value.

## Separate Operational And Book Costs

The implementation must stop using one field for two meanings.

- operational unit cost supports purchasing, recipe cost, and supplier comparison;
- accounting unit value supports inventory valuation and COGS;
- direct-expensed purchases may update operational cost but add zero book value;
- capitalized purchases update the weighted-average book value;
- accounting reports use book value only.

Historical API fields remain compatible, but response models must label which value
is operational and which is accounting value.

## Consumption Flow

### Automatic Consumption

Existing menu/modifier recipe links remain the source for automatic consumption.
Consumption occurs at the established production confirmation point and uses a stable
source key so retries cannot consume stock twice.

Each automatic movement records:

- item and quantity;
- menu/modifier recipe source;
- order and KOT source IDs;
- station;
- actor when available;
- operational and book cost snapshots;
- accounting profile and treatment snapshots.

### Manual Consumption

Add a batch consumption endpoint and matching web/Flutter workspace. A user can:

- search and add multiple inventory items;
- enter unit-aware quantities;
- choose Preparation, Staff Meal, Complimentary, Testing, or Other;
- add one optional note;
- preview resulting balances;
- submit the batch once.

Manual consumption reduces quantity and creates append-only stock movements. For
capitalized stock it creates COGS events. For direct-expensed stock it creates no new
expense.

Wastage/damage remains a separate action because it has different operational and
accounting meaning.

Manual consumption that would make stock negative is blocked by default. Users with
`inventory.negative_stock.override` may continue only after entering a reason.
Automatic production consumption remains non-blocking but creates a visible negative-
stock exception so kitchen operations do not fail because of delayed stock entry.

## Existing Restaurant Data

Existing quantities, item links, adjustments, and stock movements remain unchanged.

The migration adds treatment/profile snapshot fields without pretending that every
legacy record has a known accounting classification. Existing adjustments are
classified as follows:

1. If a matching finance event already contains treatment metadata, preserve it.
2. If a matching posted journal proves the treatment, preserve that treatment.
3. Otherwise mark the record `legacy_unclassified`.

`legacy_unclassified` is read-only and cannot be selected for new transactions.
It does not trigger a new journal or expense by itself.

### Disabled Restaurants

- historical quantities continue to work;
- reliable existing expense/payment records remain in reports;
- missing or ambiguous historical accounting is listed in an adoption audit;
- no historical inventory asset or expense is invented automatically.

### Enabling Accounting Later

Accounting activation requires an inventory adoption draft:

1. select an activation date;
2. load current physical quantities;
3. assign accounting profiles;
4. enter or import unit book values for capitalized items;
5. review legacy exceptions and duplicate-risk matches;
6. post one controlled opening inventory balance;
7. lock the adoption snapshot and start prospective accounting.

The opening entry is Debit Inventory Asset and Credit Opening Balance Equity for the
approved value. Direct-expense items receive no opening inventory value.

Changes before the activation timestamp never create COGS after activation. Only the
approved opening value and later capitalized purchases enter the book-value pool.

## Accountant Workspace

Next.js receives the full accountant-facing control surface under the existing
accounting area:

- inventory accounting health;
- profiles and mapped accounts;
- item assignments and unresolved defaults;
- adoption draft and opening valuation;
- current book valuation;
- COGS, wastage, and variance activity;
- legacy-unclassified and missing-source exceptions;
- source trace from report to journal, finance event, adjustment, and stock movement.

The normal inventory page shows only operational stock information. Accounting-
enabled users with permission may follow a link to the accounting workspace rather
than seeing ledger controls inside receive-stock dialogs.

## Web And Flutter UX

Both clients use the same simplified operational forms:

- item;
- quantity;
- total cost;
- supplier;
- paid/unpaid;
- payment method and instrument when paid;
- drawer selection only when role and drawer policy permit it;
- note.

The existing `Expense now / Stock value` selector is removed from ordinary forms.
When accounting is disabled there is no accounting copy. When it is enabled, a small
read-only profile label may appear for authorized accounting users, but it is not an
operational decision control.

Manual consumption is a dedicated action, not hidden inside corrections. The primary
inventory actions become Receive, Consume, Count, Waste, Return, and History.

## Error Handling And Consistency

- The backend ignores no unauthorized accounting request silently; it rejects it.
- All quantity, drawer, finance-event, and accounting-snapshot writes share one
  transaction boundary where possible.
- Event/source keys enforce idempotency for automatic and manual batches.
- Backdated operations into locked accounting periods are rejected.
- Current operational consumption may record its event even when posting is delayed;
  accounting health must expose the unposted event instead of losing it.
- Missing profile/account mapping blocks accounting activation and capitalized manual
  transactions, but it must not stop kitchen auto-consumption. Those events enter a
  visible exception queue.
- Profile changes and adoption posting require reasons and audit actors.

## Alembic Repair

The current local database is stamped only at `e6e682ef9b71`, but direct schema
inspection proves that the attendance branch is physically present through
`20260625_restaurant_location`. Alembic therefore tries to add attendance columns a
second time and stops before inventory migration `20260702_inventory_accounting_treatment`.

The repair procedure is:

1. capture current `alembic_version` rows and restaurant finance feature flags;
2. verify the attendance tables, columns, permission, location columns, and unique
   open-entry index before changing the stamp;
3. restore Alembic's two actual branch positions: `e6e682ef9b71` and
   `20260625_restaurant_location`;
4. run the remaining migrations to the single head;
5. restore the captured finance flags because historical migration `8d8e03b0e615`
   intentionally sets existing restaurants to disabled;
6. verify the final head, inventory treatment/profile columns, payment-bank migration,
   finance defaults, and station indexes;
7. restart the backend and verify inventory, supplier, and valuation endpoints.

This is database-state repair. The application startup hook must not gain another
temporary `ALTER TABLE` statement for inventory.

## Migration Safety

- Back up the local database or at minimum the affected schema and feature flags.
- Never use `stamp --purge` without restoring every physically applied branch head.
- Do not edit already-applied historical migrations.
- New migrations must tolerate existing legacy data through staged nullable columns,
  backfill, validation, and then non-null constraints.
- Migration verification must compare both Alembic revision state and physical schema.

## Testing

### Backend

- accounting-disabled paid and unpaid purchases resolve to direct expense;
- client-supplied asset treatment is rejected/overridden according to permission;
- accounting-enabled item profiles resolve correctly;
- direct-expensed consumption never creates COGS;
- capitalized consumption, wastage, and variance post balanced journals;
- cash purchases reduce the active drawer exactly once;
- automatic consumption retries are idempotent;
- manual batch consumption is atomic;
- negative-stock permission behavior is enforced;
- adoption opening valuation is balanced, immutable after posting, and traceable;
- legacy records are classified without duplicate events;
- migration upgrade works from a clean database and the repaired local branch state.

### Next.js

- ordinary inventory forms contain no treatment selector;
- accounting profile workspace is permission and module gated;
- manual consumption supports responsive multi-line entry and preview;
- adoption and exception screens show explicit states and source traces;
- expense, valuation, COGS, wastage, drawer, and daybook totals use authoritative
  backend values.

### Flutter

- receive/item forms contain no treatment selector;
- manual consumption matches backend validation and permissions;
- module-disabled users see no accounting terminology;
- drawer selection and cash payment behavior match web;
- targeted inventory, drawer, and finance tests pass.

## Rollout Order

1. Repair local Alembic state and apply the current missing migration.
2. Add backend policy/profile schema, resolution, permissions, and tests.
3. Add existing-data classification and adoption APIs.
4. Add manual consumption API and strengthen automatic idempotency.
5. Simplify Next.js operational inventory and add accountant workspace.
6. Simplify Flutter operational inventory and add manual consumption parity.
7. Run adoption in preview mode for test restaurants.
8. Enable and post adoption only after accountant review.

## Acceptance Criteria

- A restaurant with accounting disabled can receive and consume stock without seeing
  accounting terminology, and paid cash purchases reduce its drawer and expenses.
- An accounting-enabled restaurant derives treatment from accountant-managed item
  profiles and posts balanced inventory/COGS journals.
- Existing quantities remain unchanged and ambiguous history is visible rather than
  guessed.
- Enabling accounting requires a reviewed opening inventory valuation.
- Normal consumption, wastage, returns, counts, and receiving are distinct, simple
  operations on web and Flutter.
- Alembic reaches one head and the inventory endpoints no longer fail on the missing
  `accounting_treatment` column.
