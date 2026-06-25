# Yummy Accounting Parity Test: Flutter vs Desktop Next.js vs Backend

Date: 2026-06-21

Scope: this document tells the Flutter team what must be added or changed in the `yummy` Flutter app so it stays compatible with the current `yummy_backend` and `yummy-desktop-nextjs` accounting/day-close flow.

This is intentionally not a request to port the entire desktop accounting module to Flutter. Flutter needs the operational accounting pieces that affect daily restaurant usage: drawer sessions, daybook/day-close, opening balance, expected drawer, cash count, and clean day-close history. Full accounting ledger/admin review screens can stay desktop-only for now.

## Repositories Audited

- Backend: `/home/ramon/projects/everacy/yummy_backend`
- Desktop Next.js: `/home/ramon/projects/everacy/yummy-desktop-nextjs`
- Flutter: `/home/ramon/projects/everacy/yummy`

## Executive Verdict

Flutter already has a day-close feature, but it is behind the desktop/backend model.

The backend and desktop now treat day close as a proper operational daybook:

- Every close belongs to an exact business-date window.
- Opening balance is carried from the previous confirmed close or from drawer-session retained float.
- Expected drawer is calculated by the backend, not by frontend math.
- Actual cash is the physical counted cash.
- Reopen/re-confirm exists for correcting the same day-close record.
- Drawer sessions track actual cash drawer activity during the day.

Flutter currently has these day-close endpoints and models partially implemented, but it does not have the full drawer-session flow. That means Flutter can show/confirm day close, but it cannot yet properly support the newer drawer workflow where a cashier opens a drawer, payments attach to a drawer, cash movements are recorded, and the drawer is counted/settled before day close.

Deployment safety note: backend drawer controls must remain opt-in until Flutter ships drawer-session UI. If drawer controls are disabled, existing Flutter checkout can keep using the current payment API. If drawer controls are enabled, backend cash payments require an authenticated cashier with an open drawer session and Flutter must guide the user through that flow before checkout.

## Non-Negotiable Production Safety Rules

These are the rules that prevent Flutter from breaking while desktop/backend accounting keeps evolving.

- Keep drawer controls disabled for Flutter-heavy restaurants until Flutter implements drawer open, active drawer, cash movement, close/count, and settlement screens.
- If drawer controls are disabled, Flutter can keep its current checkout flow for cash/card/digital/fonepay/credit.
- If drawer controls are enabled, Flutter must check/open an active drawer before taking drawer-affecting payments.
- Current production-safe NC is item-level NC through `order_items.is_nc`.
- Flutter must not send `payment_method: "nc"` until backend and Flutter intentionally ship payment-method NC together.
- Unknown payment methods/statuses/movement types must parse as `unknown` or `other`, while preserving the raw string for display/debugging.
- Unknown values must never crash the app and must never be silently converted to `cash`.
- Flutter should display backend `opening_balance`, `expected_cash`, `actual_cash`, and `cash_discrepancy`, but it should not calculate or submit `opening_balance`.

## What Flutter Must Implement

Flutter must implement these three areas:

1. Day-close parity
2. Drawer-session parity
3. Checkout/payment integration with active drawers

Flutter does not need to implement these desktop accounting areas yet:

- Chart of accounts
- Journal vouchers
- Accounting period close
- Day-close accounting review/approval
- Journal trace/evidence screens
- Full ledger reports
- Accounting lock/reopen period management

## Current Flutter Status

Existing Flutter files:

- `lib/features/day_close/data/models/day_close_models.dart`
- `lib/features/day_close/data/repositories/day_close_repository_impl.dart`
- `lib/features/day_close/domain/repositories/day_close_repository.dart`
- `lib/features/day_close/presentation/bloc/day_close_bloc.dart`
- `lib/features/day_close/presentation/screens/day_close_screen.dart`
- `lib/features/day_close/presentation/screens/day_close_history_screen.dart`
- `lib/features/day_close/presentation/screens/day_close_detail_screen.dart`
- `lib/features/day_close/presentation/widgets/health_check_step.dart`
- `lib/features/day_close/presentation/widgets/financial_snapshot_step.dart`
- `lib/features/day_close/presentation/widgets/cash_reconciliation_step.dart`
- `lib/features/day_close/presentation/widgets/success_step.dart`

Flutter already supports:

- Load current day close
- Validate close
- Initiate close
- Generate snapshot
- Confirm close
- List history
- View detail
- Reopen day
- Adjust cash reconciliation
- Add income/expense adjustment
- List adjustments
- Audit log
- Saved snapshot
- Export PDF/Excel

Flutter is missing or incomplete on:

- Drawer session APIs
- Drawer open flow
- Drawer active-session state
- Drawer payment blocking when controls are enabled
- Drawer movements
- Drawer closing count
- Drawer settlement decision
- Retained float/opening balance UX
- Re-confirm UX matching desktop
- Historical business-date closing UX
- Clear explanation of opening balance, expected drawer, and actual cash

## Backend Day-Close Contract

The backend day-close routes live under:

```text
/day-closes
```

All day-close screens must treat backend values as source of truth. Do not recalculate totals in Flutter except for display-only small differences already returned by the backend.

### GET /day-closes/current

Purpose: load the current or selected business-day close.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "business_date": "2026-06-14"
}
```

`business_date` is optional. If omitted, backend resolves the current business date using the restaurant timezone and business-day start time.

Flutter requirement:

- Add endpoint helper that accepts `business_date`.
- Use `business_date` when viewing or closing a historical day.
- Show `period_start_at` and `period_end_at` exactly as backend returns them.
- Do not assume midnight-to-midnight unless the backend says so.

### GET /day-closes/validate-close

Purpose: check if a business day can be closed.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "business_date": "2026-06-14"
}
```

Response includes:

```json
{
  "can_close": true,
  "blockers": [],
  "warnings": [],
  "active_orders_count": 0,
  "pending_refunds_count": 0
}
```

Flutter requirement:

- Render blockers exactly from backend.
- Today active orders must not block closing yesterday if backend validates yesterday successfully.
- Do not run a broad local "any active orders" blocker. The blocker must be scoped to the selected business date.

### POST /day-closes/initiate

Purpose: create or prepare a pending close.

Payload:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "business_date": "2026-06-14"
}
```

Optional payload field:

```json
{
  "day_close_id": 203
}
```

Flutter requirement:

- For a normal close, send restaurant, business line, and business date.
- For re-confirming a reopened close, preserve the existing close id when backend expects it.
- Do not create a new close row every time the user restarts the wizard.

### GET /day-closes/generate-snapshot

Purpose: preview financial totals before confirmation.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "business_date": "2026-06-14"
}
```

Important returned fields:

```json
{
  "opening_balance": 620.0,
  "gross_sales": 1100.0,
  "discount_total": 80.0,
  "net_sales": 1020.0,
  "cash_sales": 550.0,
  "card_sales": 0.0,
  "digital_sales": 550.0,
  "credit_sales": 0.0,
  "credit_collections": 0.0,
  "manual_cash_income": 0.0,
  "expense_total": 0.0,
  "refund_total": 0.0,
  "expected_cash": 5325.0,
  "actual_cash": null
}
```

Flutter requirement:

- Show opening balance.
- Show expected cash/drawer.
- Show payment method breakdown.
- Show credit sales and credit collections separately.
- Show expenses/refunds.
- Show clear labels, not just raw backend names.

### POST /day-closes/{id}/confirm

Purpose: finalize a day close.

Payload:

```json
{
  "actual_cash": 4775.0,
  "confirmation_notes": "Cash matched after owner cash drop."
}
```

Flutter requirement:

- `actual_cash` must be the physical counted cash.
- If actual cash differs from expected cash, require notes.
- If drawer sessions are enabled, actual cash may be enforced from drawer counted totals. Flutter should display backend errors directly and not override them.

### POST /day-closes/{id}/cancel

Payload:

```json
{
  "cancel_reason": "Started by mistake"
}
```

Flutter requirement:

- Support cancellation only for pending closes.
- Do not show cancel for confirmed closes.

### POST /day-closes/{id}/reopen

Payload:

```json
{
  "reopen_reason": "Correction required for missed payment"
}
```

Flutter requirement:

- Reopen is admin-level.
- Reopen only reopens a confirmed close that backend allows.
- After reopen, the same close must be re-confirmed. Do not create a new close for the same business day.
- Use a clear banner: "This close is reopened. Make corrections, then re-confirm this day."

### POST /day-closes/{id}/adjust-cash-reconciliation

Purpose: correct the recorded physical cash count after close.

Payload:

```json
{
  "actual_cash": 4800.0,
  "adjustment_reason": "Cash count corrected after recount",
  "adjustment_notes": "Original count missed Rs. 25 coins."
}
```

Flutter requirement:

- This changes actual cash/reconciliation, not sales.
- It should be an admin or manager-only action.
- Use this when the physical cash count was wrong.

### POST /day-closes/{id}/adjustments/expense

Purpose: add a missed expense after close.

Payload:

```json
{
  "amount": 1000.0,
  "payment_method": "cash",
  "description": "Owner cashout",
  "category_id": null,
  "notes": "Cash removed from drawer after service."
}
```

Flutter requirement:

- This is not the same as cash reconciliation.
- This creates a financial adjustment and may affect expense totals/cash position.
- Use only when a real missed expense or cash-out needs to be recorded.

### POST /day-closes/{id}/adjustments/income

Payload:

```json
{
  "amount": 500.0,
  "payment_method": "cash",
  "description": "Missed manual cash income",
  "notes": "Recorded after close."
}
```

Flutter requirement:

- Optional in mobile for phase 1.
- If implemented, keep it admin/manager-only.

### GET /day-closes/{id}/adjustments

Purpose: list post-close financial adjustments.

Flutter requirement:

- Show adjustments in detail view if Flutter exposes post-close edits.
- Do not hide adjustments after success; users need audit visibility.

### GET /day-closes

Purpose: history list.

Query:

```json
{
  "restaurant_id": 52,
  "date_from": "2026-06-01",
  "date_to": "2026-06-14",
  "status": "confirmed",
  "business_line": "restaurant",
  "skip": 0,
  "limit": 50
}
```

Flutter requirement:

- Add date range filters.
- Add status filters: all, open, pending, confirmed, reopened.
- Show `business_date`, `period_start_at`, `period_end_at`, `status`, `net_sales`, `expected_cash`, `actual_cash`.

### GET /day-closes/sessions

Purpose: lightweight confirmed close windows for analytics/daybook filters.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "skip": 0,
  "limit": 50
}
```

Flutter requirement:

- Optional for phase 1.
- Required only if Flutter analytics filters by confirmed daybook sessions.

### GET /day-closes/{id}

Purpose: detail view.

Flutter requirement:

- Must show server snapshot values.
- Must not recalculate frozen totals in the browser/app.

### GET /day-closes/{id}/snapshot

Purpose: saved snapshot for a confirmed close.

Flutter requirement:

- Use for confirmed day detail.
- Display as frozen/server snapshot.

### GET /day-closes/{id}/audit-log

Purpose: audit trail.

Flutter requirement:

- Optional for phase 1.
- Recommended for manager/admin users.

### GET /day-closes/{id}/export/pdf and /export/excel

Flutter requirement:

- Optional.
- If added, open/download server-generated files.

## Drawer Session Contract

Drawer sessions are the biggest missing Flutter piece.

The backend drawer routes live under:

```text
/drawer-sessions
```

Desktop uses these routes to make opening balance and expected drawer reliable.

Flutter must implement a minimal drawer module if mobile app users take payments from Flutter.

### GET /drawer-sessions/openable-configurations

Purpose: list drawers the current user can open.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant"
}
```

Flutter requirement:

- On app start or before first payment, check if drawer controls are enabled and which drawer can be opened.
- If there is only one drawer, preselect it.
- If there are multiple drawers/stations, ask user to choose.

### GET /drawer-sessions/suggestion

Purpose: suggest opening cash.

Query:

```json
{
  "restaurant_id": 52,
  "business_date": "2026-06-14",
  "business_line": "restaurant",
  "station": "general",
  "drawer_key": "main"
}
```

Response concept:

```json
{
  "configuration_id": 1,
  "amount": 620.0,
  "source": "previous_retained_float",
  "opening_variance_tolerance": 0.0,
  "opening_variance_enforced": true
}
```

Flutter requirement:

- Show suggested opening cash before opening drawer.
- Explain source:
  - `previous_retained_float`: carried from prior drawer settlement.
  - `standard_float`: configured standard drawer float.
  - `none` or equivalent: no previous amount available.

### POST /drawer-sessions/open

Purpose: open a drawer session for the business date.

Payload:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant",
  "station": "general",
  "drawer_key": "main",
  "business_date": "2026-06-14",
  "counted_opening_cash": 620.0,
  "denominations_json": null,
  "reason": "Opening drawer",
  "approved_by_id": null
}
```

Flutter requirement:

- User counts opening cash.
- Send counted value, not just suggested value.
- If backend returns variance/tolerance error, show it clearly.

### GET /drawer-sessions/active

Purpose: find active drawer sessions for the user/restaurant.

Query:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant"
}
```

Flutter requirement:

- Before taking cash/card/digital payment, check active drawer if drawer controls are enabled.
- If no active drawer exists and controls are enabled, block payment and ask user to open drawer.
- If controls are disabled, old payment flow can continue.

### POST /drawer-sessions/{sessionId}/movements

Purpose: record physical cash movement in a drawer.

Payload:

```json
{
  "source_key": "owner-cashout-2026-06-14-001",
  "movement_type": "expense",
  "signed_amount": -1000.0,
  "payment_method": "cash",
  "occurred_at": "2026-06-14T12:30:00Z",
  "metadata_json": {
    "description": "Owner cashout"
  }
}
```

Important: backend validates that drawer movements are physical cash only. Do not send card/digital as drawer cash movements.

Flutter requirement:

- Implement cash-in/cash-out UI if mobile cashiers need to record owner cashout, cash drop, transfer in/out, or adjustment.
- Use signed amounts:
  - Cash in: positive
  - Cash out: negative
- Use backend movement type strings exactly.

### GET /drawer-sessions/{sessionId}/expected-breakdown

Purpose: show expected cash calculation for a drawer.

Returned fields include:

```json
{
  "opening_float": 620.0,
  "cash_sales": 550.0,
  "manual_income": 0.0,
  "receivable_collections": 0.0,
  "refunds": 0.0,
  "expenses": 0.0,
  "inventory_payments": 0.0,
  "supplier_payments": 0.0,
  "cash_drops": 0.0,
  "transfers_in": 0.0,
  "transfers_out": 0.0,
  "adjustments": 0.0,
  "expected_cash": 1170.0,
  "counted_cash": null,
  "variance": null
}
```

Flutter requirement:

- Use this for drawer close/count screens.
- Do not build a local formula that can drift from backend.

### GET /drawer-sessions/{sessionId}/closing-prompt

Purpose: show whether blind count is enabled and whether expected cash can be shown.

Flutter requirement:

- If blind count is enabled, hide expected cash until count is submitted.
- If blind count is disabled, show expected cash before count.

### POST /drawer-sessions/{sessionId}/closing-count

Purpose: submit physical counted closing cash.

Payload:

```json
{
  "counted_closing_cash": 4775.0,
  "denominations_json": null,
  "reason": "End of day count"
}
```

Flutter requirement:

- User enters physical cash count.
- Backend returns variance.
- If variance requires approval, show approval flow or block based on permission.

### POST /drawer-sessions/{sessionId}/settlement-decision

Purpose: decide what cash remains in drawer and what gets transferred/deposited.

Payload:

```json
{
  "retained_float": 620.0,
  "settlement_mode": "safe_transfer",
  "settlement_amount": 4155.0,
  "settlement_destination": "Main safe",
  "settlement_reference": "SAFE-2026-06-14",
  "reason": "End of day settlement"
}
```

Allowed `settlement_mode` values:

- `safe_transfer`
- `pending_bank_deposit`
- `immediate_bank_deposit`
- `retain_all`

Flutter requirement:

- This is important for next day's opening balance.
- `retained_float` becomes the suggested opening amount for the next drawer session.
- Do not treat all counted cash as next day's opening cash. Only retained float carries forward.

### POST /drawer-sessions/{sessionId}/approve-variance

Purpose: approve over/short variance.

Flutter requirement:

- Optional in phase 1.
- If not implemented, show backend error and tell user to use desktop/admin.

### POST /drawer-sessions/{sessionId}/reopen

Purpose: reopen a drawer session.

Flutter requirement:

- Optional in phase 1.
- Admin/manager only.

## Required Flutter UX Flows

### Flow 1: Start of Day / Open Drawer

1. User opens Flutter app.
2. Flutter fetches current restaurant and business line.
3. Flutter calls `GET /drawer-sessions/active`.
4. If an active drawer exists, use it.
5. If no active drawer exists and drawer controls are enabled, Flutter calls `GET /drawer-sessions/openable-configurations`.
6. User chooses drawer/station if needed.
7. Flutter calls `GET /drawer-sessions/suggestion`.
8. Flutter asks user to count opening cash.
9. Flutter calls `POST /drawer-sessions/open`.
10. After successful open, payments are allowed.

Minimum mobile UI:

- "Open Drawer" screen/sheet
- Suggested opening cash
- Counted opening cash input
- Optional denominations input
- Error display for variance/tolerance

### Flow 2: Take Payment During Day

1. User opens checkout/payment.
2. Flutter checks whether drawer controls are active.
3. If controls are active and no drawer session is open, block payment.
4. If drawer is open, allow payment.
5. Payment APIs remain the same; backend/order service records finance/drawer effects.

Important:

- Flutter should not create drawer movements for normal sales payments manually unless backend API specifically requires it. Current backend order payment flow is responsible for payment-side finance events.
- Flutter should only create drawer movements for explicit cash movement actions: owner cashout, cash drop, transfer, adjustment.

### Flow 3: Cash Out / Cash Movement

Use this when physical cash leaves or enters drawer outside normal order payment.

Examples:

- Owner withdraws cash
- Cash transferred to safe
- Petty cash expense
- Cash added to drawer
- Correction adjustment

Flutter action:

- Use `POST /drawer-sessions/{sessionId}/movements`.
- Use physical cash only.
- Show movement in drawer detail/history.

Recommended labels:

- Cash In
- Cash Out
- Cash Drop
- Transfer Out
- Adjustment

### Flow 4: End of Day Without Drawer Controls

If drawer controls are disabled:

1. User opens Day Close.
2. Flutter calls `GET /day-closes/current`.
3. Flutter calls `GET /day-closes/validate-close`.
4. Flutter calls `POST /day-closes/initiate`.
5. Flutter calls `GET /day-closes/generate-snapshot`.
6. User enters actual cash.
7. Flutter calls `POST /day-closes/{id}/confirm`.

Flutter must show:

- Gross sales
- Net sales
- Total income
- Expenses
- Opening balance
- Expected drawer
- Actual cash
- Cash discrepancy
- Credit sales
- Credit collections
- Outstanding receivables

### Flow 5: End of Day With Drawer Controls

If drawer controls are enabled:

1. User closes/counts all active drawer sessions.
2. For each drawer, Flutter calls closing prompt/count/settlement APIs.
3. Flutter opens Day Close.
4. Backend snapshot uses drawer-session evidence.
5. User confirms day close.

Important:

- Day close should not invent its own drawer actual cash.
- If drawers are active/unsettled and backend blocks confirmation, show the backend blocker.

### Flow 6: Closing Yesterday While Today Has Active Orders

This is a critical parity case.

Expected behavior:

- If yesterday was not closed, user can select yesterday's business date.
- Today active orders should not block closing yesterday.
- Validation, snapshot, and reconciliation must use the selected business-day window only.

Flutter requirement:

- Add historical business-date selection.
- Always pass `business_date` to current, validate, initiate, and snapshot calls when closing a non-current date.
- Do not run client-side active-order blockers across all orders.

### Flow 7: Reopen and Re-confirm

Expected behavior:

1. Admin opens confirmed close detail.
2. Admin taps Reopen.
3. Backend marks same close as `reopened`.
4. UI shows reopened banner.
5. Admin makes corrections.
6. Admin taps Re-confirm Day Close.
7. Same close id is confirmed again.

Flutter requirement:

- Do not create duplicate closes for one business day.
- Reconfirm should use the same modal/wizard as close, but in re-confirm mode.
- Show status clearly: open, pending, confirmed, reopened.

## Calculation Glossary for Flutter UI

Flutter should show these labels and helper texts.

### Gross Sales

Meaning: total order value before discounts/refunds that backend includes in sales.

Display text:

```text
Gross Sales = order value before discounts.
```

### Net Sales

Meaning: sales after discount/service/tax rules according to backend.

Display text:

```text
Net Sales = Gross Sales - Discounts + Tax + Service Charge.
```

Nepal note: service charge may be zero/disabled.

### Total Income

Meaning: total recognized income for this day-close window.

Display text:

```text
Total Income = Net Sales + Manual Income - Refunds.
```

Use backend value as source of truth.

### Opening Balance

Meaning: cash carried into the day.

If drawer sessions are disabled:

```text
Opening Balance = previous confirmed day close actual cash.
```

If drawer sessions are enabled:

```text
Opening Balance = opening cash from drawer sessions, usually previous retained float.
```

### Expected Drawer

Meaning: how much physical cash should be in the drawer at close.

Display text:

```text
Expected Drawer = Opening Balance + Cash Sales - Cash Refunds + Cash Credit Collections + Manual Cash Income - Cash Expenses.
```

If drawer sessions are enabled, backend drawer expected breakdown is source of truth.

### Actual Cash

Meaning: physical cash counted by the user.

Display text:

```text
Actual Cash = the physical cash counted in the drawer.
```

### Cash Discrepancy

Meaning: over/short amount.

Display text:

```text
Cash Discrepancy = Actual Cash - Expected Drawer.
```

Positive means extra cash. Negative means shortage.

### Credit Sales

Meaning: order amount charged to a customer instead of paid immediately.

Display text:

```text
Credit Sales = sales added to customer balance during this business day.
```

### Credit Collection

Meaning: old customer credit collected today.

Display text:

```text
Credit Collection = customer balance payments received today.
```

### Outstanding Receivables

Meaning: total customer balance still owed.

Display text:

```text
Outstanding Receivables = unpaid customer credit still due.
```

### Expenses

Meaning: expenses recorded for this business day or post-close adjustments.

Display text:

```text
Expenses = cash or non-cash expenses recorded against this day.
```

## Permission Parity

Flutter should honor these backend permissions and show/hide actions accordingly.

Day close:

- View day close: `reports.dayclose.view` or `reports.daily.view`
- Initiate close: `reports.dayclose.initiate`
- Confirm close: `reports.dayclose.confirm`
- Cancel close: `reports.dayclose.cancel`
- Reopen close: `reports.dayclose.reopen` or admin setting authority
- Adjust cash reconciliation: `reports.dayclose.adjust.cash` or admin setting authority
- Add income/expense adjustment: `reports.dayclose.adjust.financial` or admin setting authority
- Export: `reports.dayclose.export` or `reports.export`
- Audit: `reports.dayclose.audit.view`

Drawer sessions:

- Open own drawer: `finance.drawer.open.own`
- Open any drawer: `finance.drawer.open.any`
- Manage drawer setup: `finance.accounting.setup`
- Record expenses/movements: movement-specific finance permissions apply on backend
- Approve variance: manager/admin drawer variance permission
- Settlement decision: drawer settlement permission

Flutter should still show backend 403 messages cleanly if local permission data is stale.

## Flutter Endpoint Builder Changes

Current Flutter has `DayCloseApis` as string getters in `lib/core/api/endpoints.dart`. That can work, but it makes query construction scattered in repositories.

Recommended update:

- Add helper methods that mirror desktop endpoint builders.
- Add `businessDate` support to current, validate, and generate snapshot helpers.
- Add a new `DrawerSessionApis` class.

Suggested API shape:

```dart
class DayCloseApis {
  String current({required int restaurantId, String businessLine = 'restaurant', String? businessDate});
  String validateClose({required int restaurantId, String businessLine = 'restaurant', String? businessDate});
  String generateSnapshot({required int restaurantId, String businessLine = 'restaurant', String? businessDate});
  String get initiate;
  String confirm(int id);
  String cancel(int id);
  String reopen(int id);
  String adjustCashReconciliation(int id);
  String addExpenseAdjustment(int id);
  String addIncomeAdjustment(int id);
  String adjustments(int id);
  String detail(int id);
  String savedSnapshot(int id);
  String auditLog(int id);
  String exportPdf(int id);
  String exportExcel(int id);
  String list({int? restaurantId, String? start, String? end, String? status, String? businessLine, int? skip, int? limit});
  String sessions({required int restaurantId, String businessLine = 'restaurant', int skip = 0, int limit = 50});
}
```

Suggested new drawer API:

```dart
class DrawerSessionApis {
  String configurations({required int restaurantId, String businessLine = 'restaurant'});
  String openableConfigurations({required int restaurantId, String businessLine = 'restaurant'});
  String get saveConfiguration;
  String cashiers({required int restaurantId});
  String assignments({required int restaurantId, String businessLine = 'restaurant'});
  String get saveAssignment;
  String controls({required int restaurantId, required bool enabled});
  String suggestion({required int restaurantId, required String businessDate, String businessLine = 'restaurant', String station = 'general', required String drawerKey});
  String get open;
  String active({required int restaurantId, String businessLine = 'restaurant'});
  String movement(int sessionId);
  String closingPrompt(int sessionId);
  String expectedBreakdown(int sessionId);
  String closingCount(int sessionId);
  String settlementDecision(int sessionId);
  String approveVariance(int sessionId);
  String reopen(int sessionId);
}
```

## Flutter Model Changes Needed

Day-close models should include and preserve:

- `business_date`
- `business_line`
- `period_start_at`
- `period_end_at`
- `status`
- `opening_balance`
- `gross_sales`
- `discount_total`
- `tax_total`
- `service_charge_total`
- `net_sales`
- `cash_sales`
- `card_sales`
- `digital_sales`
- `fonepay_sales`
- `credit_sales`
- `credit_collections`
- `manual_cash_income`
- `outstanding_receivables`
- `expense_total`
- `refund_total`
- `expected_cash`
- `actual_cash`
- `cash_discrepancy`
- `net_cash_position`
- `confirmed_at`
- `confirmation_notes`
- `reopened_count`
- `last_reopened_at`
- `reopen_reason`

New drawer models required:

- `DrawerConfiguration`
- `DrawerOpeningSuggestion`
- `DrawerSession`
- `DrawerMovement`
- `DrawerExpectedBreakdown`
- `DrawerClosingPrompt`
- `DrawerCount`
- `DrawerSettlementDecisionRequest`

Flutter parsing rule:

- Parse unknown optional fields safely.
- Never crash on new backend fields.
- For enums, prefer string-backed parsing with fallback `unknown` instead of strict enum crash.

## Backend Compatibility Warning for Flutter

Flutter must not hardcode backend enum values so tightly that a new value breaks the app.

Known risky area:

- Payment method strings
- Day-close status strings
- Drawer movement types
- Drawer settlement modes

Recommended Flutter pattern:

```dart
enum SafePaymentMethod {
  cash,
  card,
  digital,
  fonepay,
  credit,
  other,
  unknown,
}
```

Keep the raw string too:

```dart
final String rawPaymentMethod;
```

Display unknown safely:

```text
Unknown payment method: <raw>
```

Do not crash analytics/day-close screens because one payment method string is unexpected.

Important NC compatibility rule:

- The safe production path keeps item-level NC as the active behavior.
- Do not send `payment_method: "nc"` from Flutter unless backend `PaymentMethodEnum` and Flutter `PaymentMethod` are intentionally upgraded together.
- If Flutter receives an unknown payment method string from older test data, display it as `unknown` or `other`; do not crash and do not silently turn it into cash.
- Item-level NC and payment-method NC must not be mixed in the same production reporting flow.

Current NC implementation target for Flutter:

- Use `POST /orders/{order_id}/items/bulk-update` to toggle `is_nc` on order items.
- Keep NC items visible in order detail, KOT, and receipt context.
- Let backend order math reduce payable amount for item-level NC.
- For a fully NC order, keep customer selection available even when payable total becomes zero, so the restaurant can attach accountability if needed.
- Do not create `order_payments.method = "nc"` rows in Flutter for this safe branch.
- Read NC reporting from the backend-supported NC analytics response for the deployed branch.

## Minimum Flutter Screen Updates

### Day Close Main Screen

Add or verify:

- Business line selector
- Current business date label
- Period label
- Current close card
- Opening balance card
- Net sales card
- Expected drawer card
- Total expenses card
- Status badge
- Close/Re-confirm button
- History filters

### Day Close Wizard

Steps:

1. Health check
2. Snapshot review
3. Cash reconciliation
4. Success

Must support modes:

- Normal close
- Historical date close
- Re-confirm reopened close

### Snapshot Review Step

Must show:

- Payment method breakdown
- Opening balance
- Expected drawer
- Credit sales
- Credit collections
- Expenses
- Refunds
- Cash formula helper

### Cash Reconciliation Step

Must show:

- Expected drawer
- Actual cash input
- Difference
- Notes required if mismatch
- If drawer sessions are enabled, guide user to close/count drawers first.

### Day Close History

Must show:

- Date range filter
- Status filter
- Business line filter
- Confirmed-only filter optional
- Open/pending/confirmed/reopened badges
- Net
- Expected
- Actual
- Period label

### Day Close Detail

Must show:

- Frozen snapshot data for confirmed close
- Reopened warning for reopened close
- Reconfirm action for reopened close
- Adjust cash action
- Add adjustment action
- Adjustments tab/list
- Audit tab/list if permission allows
- Export actions

### Drawer Session Screens

New minimum screens/sheets:

- Open Drawer
- Active Drawer Summary
- Cash Movement
- Close Drawer Count
- Settlement Decision

## Essential Test Matrix

Run these against local backend and local Flutter.

### Test 1: Normal Day Close Without Drawer Controls

Setup:

- Drawer controls disabled.
- Create completed cash/card/digital/credit orders.

Expected:

- Validate close passes.
- Snapshot totals match backend.
- Opening balance appears.
- Expected drawer appears.
- Actual cash can be submitted.
- Confirmed close appears in history.

### Test 2: Historical Day Close

Setup:

- Yesterday has completed orders and was not closed.
- Today has active orders.

Expected:

- User selects yesterday.
- Yesterday validation passes if yesterday has no active/unpaid blockers.
- Today active orders do not block yesterday.
- Snapshot covers yesterday only.

### Test 3: Reopen and Re-confirm

Setup:

- Confirm a day close.
- Reopen it.

Expected:

- Same close id changes to reopened.
- UI shows reopened banner.
- Reconfirm uses same close id.
- No duplicate close row is created for same business date.

### Test 4: Cash Discrepancy

Setup:

- Expected cash Rs. 1000.
- Actual cash Rs. 950.

Expected:

- Notes required.
- Cash discrepancy = -50.
- Confirm succeeds only with notes.
- Detail screen shows expected, actual, discrepancy.

### Test 5: Opening Balance Carry Forward

Setup:

- Day 1 confirmed with actual cash Rs. 620.
- Day 2 starts.

Expected without drawer controls:

- Day 2 opening balance = Rs. 620.

Expected with drawer controls:

- Day 2 opening suggestion uses previous retained float, not necessarily whole previous actual cash.

### Test 6: Drawer Open

Setup:

- Drawer controls enabled.
- User has drawer open permission.

Expected:

- Flutter shows openable drawer.
- Suggested opening cash appears.
- User enters counted opening cash.
- Backend opens drawer session.
- Active drawer appears.

### Test 7: Payment Requires Drawer

Setup:

- Drawer controls enabled.
- No drawer session open.

Expected:

- Cash/card/digital payment screen blocks payment.
- User is told to open drawer first.
- Once drawer is open, payment can proceed.

### Test 8: Cash Movement

Setup:

- Drawer open.
- Owner withdraws Rs. 1000 cash.

Expected:

- Flutter records drawer cash-out movement.
- Expected drawer decreases according to backend expected breakdown.
- Movement is visible in drawer/session detail.

### Test 9: Drawer Closing Count

Setup:

- Drawer has opening cash and payments.

Expected:

- Closing prompt loads.
- User enters counted closing cash.
- Backend returns variance.
- User settles retained float and transfer amount.
- Day close uses drawer evidence.

### Test 10: Permission Denial

Setup:

- User lacks reopen or adjust permission.

Expected:

- Button hidden if local permission known.
- If user still hits endpoint, backend 403 shown cleanly.

## What Flutter Should Not Do

Do not:

- Recalculate frozen confirmed day-close totals locally.
- Close a day using today's active orders as blockers for yesterday.
- Create a new day-close row when re-confirming an existing reopened day.
- Treat all previous actual cash as next opening cash when drawer settlement uses retained float.
- Record non-cash drawer movements.
- Port desktop accounting review/ledger/COA screens in the first Flutter parity pass.
- Crash on unknown backend enum/string values.

## Suggested Implementation Order

1. Update day-close endpoint builders to support `business_date`, `skip`, and `limit`.
2. Add missing day-close fields to models and UI: opening balance, period window, reopened state, expected/actual/discrepancy.
3. Fix historical close flow so selected business date is passed everywhere.
4. Fix reopen/re-confirm flow to use the same close id.
5. Add drawer-session API/models/repository.
6. Add open drawer and active drawer UI.
7. Gate checkout payments when drawer controls are enabled and no active drawer exists.
8. Add drawer closing count and settlement decision.
9. Add cash movement UI for cash in/out.
10. Run the full test matrix above.

## Phase Recommendation

### Phase 1: Must ship

- Day-close exact business-date support
- Opening balance display
- Expected drawer display
- Historical close support
- Reopen/re-confirm same close id
- Safe enum parsing
- Drawer active/open flow before enabling drawer controls for mobile restaurants
- Checkout payment block with clear "open drawer first" message when drawer controls are enabled and no drawer is open

### Phase 2: Strongly recommended

- Drawer closing count
- Settlement decision
- Retained float carry-forward UX
- Cash movement/cashout UI
- Day-close adjustment UI

### Phase 3: Desktop-only unless product decides otherwise

- Accounting review
- Journal trace
- Chart of accounts
- Period close accounting
- Full reports

## Final Parity Definition

Flutter is day-close/accounting compatible when all of these are true:

- A mobile cashier can open the correct drawer for the business day.
- Mobile payments do not bypass drawer controls.
- A manager can close the correct business day from Flutter.
- Closing yesterday is not blocked by today's active orders.
- Opening balance and expected drawer match backend/desktop.
- Reopened days are re-confirmed on the same close record.
- Flutter does not crash on backend enum/string additions.
- Flutter can safely operate without implementing the full desktop accounting module.
- Backend drawer controls are not enabled for Flutter-heavy restaurants until the mobile drawer flow exists.
