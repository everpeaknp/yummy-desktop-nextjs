# Web Parity Audit: Backend + Flutter Delta

Date: 2026-06-02

Repos reviewed:

- Flutter app: `C:\flutter applications\yummy`
- Backend: `C:\yummy_backend`
- Web app: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`

This document is an implementation handoff for bringing the web app up to parity with the current backend and Flutter app.

## Executive Summary

The web app is behind in the financial and reporting flows. The biggest issue is not just missing screens. The web currently still assumes older product rules in several places:

- Day Close is still treated like a date-based close with a manual business date.
- Analytics still renders an older flat response shape instead of the new tabbed `/analytics/dashboard` response. This is not just a missing UI issue: the web can receive a valid response and still interpret it incorrectly.
- Analytics day-close filtering is missing. Flutter can select a confirmed day-close/daybook session and load analytics for that exact `period_start_at` to `period_end_at` window.
- Dashboard partially calls `/admin/dashboard/v2`, but does not fully render the new backend `home` model. The Flutter app is already using dashboard v2 as the current dashboard contract.
- Transactions do not support `payment_user_id` and order transactions still open the transaction detail UI.
- Expense screen payment-method breakdown is missing or incomplete in web. Flutter now shows an expense payment-method section using the same visual component as income payment methods.
- Split bill/guest bill endpoints are missing from web API helpers and checkout UI.
- Multi-payment UI is missing in web. It is already implemented in the Flutter app, while the backend supports it through multiple order-payment rows.
- Change Table merge into an occupied table is missing in web. Flutter now supports moving to a free table or merging the source bill into the active order on an occupied/bill-printed table.
- Multi-table order assignment is also incomplete in web POS flows. Backend supports `table_ids`, but web mostly treats table selection as single-table.
- Restaurant and Hotel scope handling is incomplete. This is high risk because restaurant reports must exclude hotel/room-service financials.
- Hotel Close is not implemented in web.
- Day Close report/history does not fully expose exact covered windows, payment instruments, and credit-settlement order detail.

## Flutter Parity References

Use the Flutter app as the behavior reference for these specific areas. Do not re-interpret the old web behavior as the product contract.

- Multi-payment is implemented in Flutter:
  - `lib/features/orders/presentation/widgets/add_payment_bottom_sheet.dart`
  - Key concepts in that file: `_multiPaymentEnabled`, `Multiple Payment`, and the separate multiple-payment screen.
- Analytics is implemented against the new tabbed dashboard response:
  - `lib/features/analytics/data/models/analytics_dashboard_response.dart`
  - The parser reads `json["tabs"]["overview"]`, `json["tabs"]["finance"]`, `json["tabs"]["orders"]`, `json["tabs"]["menu"]`, and `json["tabs"]["staff"]`.
  - `lib/features/analytics/presentation/bloc/analytics_bloc.dart` converts the backend `data` payload with `AnalyticsDashboardResponse.fromJson(data)`.
- Analytics day-close/daybook filtering is implemented in Flutter:
  - `lib/features/analytics/presentation/bloc/analytics_bloc.dart`
  - `lib/features/analytics/presentation/screens/analytics_screen.dart`
  - It loads confirmed sessions from `AppApi.dayCloseApis.sessions(...)`.
  - A selected `DayCloseSessionModel` supplies `periodStartAt` and `periodEndAt`.
  - Analytics then sends `start_time=periodStartAt` and `end_time=periodEndAt` to `/analytics/dashboard`.
  - Selecting a session also uses that session's `business_line` and clears station filtering.
- Dashboard is implemented against `/admin/dashboard/v2`:
  - `lib/core/api/endpoints.dart`
  - `lib/features/admin/presentation/bloc/admin_dashboard/admin_dashboard_bloc.dart`
  - `lib/core/mapper/dashboard_mapper/dashboard_v2_mapper.dart`
- Expense payment-method breakdown is implemented in Flutter:
  - `lib/features/finance/expenses/presentation/screens/expenses_screen.dart`
  - The screen reuses `IncomePaymentMethodsSection`.
  - `_buildExpensePaymentMethodBreakdown(...)` groups loaded `ExpenseEntity.paymentMethod` rows and sums expense amounts by normalized method.
  - This is an expense breakdown, not an income/payment collection breakdown.
- Change Table merge into occupied table is implemented in Flutter:
  - `lib/features/tables/presentation/screens/change_table_screen.dart`
  - It uses `TransferGuestBillTableUseCase`.
  - Occupied and bill-printed tables are selectable merge targets.
  - Free tables are move targets.
  - The result checks `data["action"]`, where `merged` shows "Bill merged" and `moved` shows "Bill moved".
- Multi-table support exists through `table_ids`, especially in reservation flows, and the same backend field is available for table/group orders.

Practical consequence for web:

- Web analytics must stop mapping old keys like `data.overview`, `data.kpis`, `data.comparison`, `data.trends_chart`, and `data.breakdown`.
- Web analytics must add the day-close/daybook session selector and use exact `start_time/end_time` from the selected session.
- Web dashboard must stop treating `/admin/dashboard/v2` as a partial supplement to older analytics/dashboard state.
- Web expenses must show payment-method breakdown using the same section pattern as income, with expense amounts.
- Web checkout must add the multi-payment path, not just repeated manual single-payment entry.
- Web change-table flow must support merge into occupied tables through `/orders/{guest_order_id}/guest-bills/transfer-table`.
- Web order/table flows should also support `table_ids` when the business action is "assign multiple tables to one order".

The web developer should treat backend responses as authoritative. Do not reconstruct close totals client-side by fetching orders, expenses, and tables.

## Non-Negotiable Business Rules

### 1. Restaurant and Hotel are separate financial scopes

Use `business_line` everywhere financial data is loaded or created.

Allowed values:

- `restaurant`
- `hotel`

Rules:

- Restaurant analytics and Restaurant Close include only `Order.business_line = restaurant`.
- Restaurant analytics and Restaurant Close exclude room-service/hotel orders completely.
- Hotel analytics and Hotel Close include `Order.business_line = hotel`.
- Room-service food belongs financially to Hotel because payment is collected in Hotel.
- Hotel close splits revenue into:
  - `room_revenue`: order item `revenue_category = rent`
  - `food_revenue`: all non-rent items
- Expenses, expense categories, and general purchases must be explicitly owned by `business_line`.
- Hotel screens must create hotel-owned categories, expenses, and purchases.
- Restaurant screens must create restaurant-owned categories, expenses, and purchases.

### 2. Day Close is an exact-time window, not a calendar-day boundary

Each confirmed close covers:

```text
(previous confirmed close period_end_at, current confirmed close period_end_at]
```

Rules:

- `period_start_at` is exclusive.
- `period_end_at` is inclusive.
- First close starts from restaurant `created_at`.
- `business_date` is retained only as the local close date for compatibility and filtering.
- Web must show the covered range, for example:
  - `Covers Jun 1, 11:40 PM - Jun 3, 8:15 PM`
- Web should remove manual "Business Date" override from day-close initiation.

### 3. Analytics is cash/payment-event oriented

Analytics payment summaries and station summaries use successful payments, not just completed-order totals.

Rules:

- Card and digital payments must show instrument detail.
- Do not send `station=all`; omit `station` when all stations are selected.
- For a selected day-close session, call analytics with `start_time` and `end_time`, not `date_from` and `date_to`.

### 4. Transactions distinguish creator vs payment collector

There are two different filters:

- `user_id`: generic staff/user attribution.
- `payment_user_id`: user who added the order payment.

When `payment_user_id` is selected, force transaction type scope to `order`.

## Current Web Gaps By File

### API helpers

File: `lib/api/endpoints.ts`

Missing or incomplete:

- `DashboardApis.dashboardDataV2` does not accept `businessLine` or `timezone`.
- `DashboardApis.dashboardDelta` does not accept `businessLine`, `timezone`, `date`, `startTime`, or `endTime`.
- `DayCloseApis` has no `sessions` helper.
- `DayCloseApis.list` has no `businessLine`, `skip`, or `limit`.
- `DayCloseApis.current`, `validateClose`, and `generateSnapshot` are raw string constants, so screens repeatedly build params manually and miss `business_line`.
- `TransactionsApis.list` has no `paymentUserId`.
- `GeneralPurchaseApis.list` has no `businessLine`.
- `AnalyticsApis.inventoryDetails` has no `businessLine`.
- `OrderApis` is missing guest-bill/split-bill helpers:
  - `getGuestBills`
  - `splitBill`
  - `payAllGuestBills`
  - `transferGuestBillItem`
  - `mergeGuestBills`
  - `cancelGuestBillSplit`
  - `transferGuestBillTable`

### Analytics screen

Files:

- `app/(dashboard)/analytics/page.tsx`
- `lib/analytics-dashboard-mapper.ts`

Problems:

- The page calls `GET /analytics/dashboard`, but renders old flat keys like `overview`, `kpis`, `comparison`, `trends_chart`, `breakdown`, and `menu_snapshot`.
- The backend now returns `data.meta` and `data.tabs`.
- There is no day-close session selector.
- Selecting a day-close session should pass exact `start_time` and `end_time`.
- Day-close session options should come from `GET /day-closes/sessions?business_line=...`.
- A selected session should show its covered range, for example `Covers Jun 1, 11:40 PM - Jun 3, 8:15 PM`.
- While a session is selected, the analytics query should use that session's `business_line`; station should be cleared unless backend intentionally supports station inside close-session filtering.
- The current "All Services" default is risky. The Flutter app treats Restaurant as the default financial view. Web can still offer "All" as a separate mode, but it should not be the default if the goal is restaurant parity.
- Payment method section should use `payment_mix.items` and `payment_mix.income_by_payment_instrument` from the selected tab.

### Dashboard screen

File: `app/(dashboard)/dashboard/page.tsx`

Problems:

- It calls `/admin/dashboard/v2` but does not pass `business_line` or `timezone`.
- It still mixes in separate analytics calls for dashboard chart data.
- It does not fully render the backend v2 `home` sections.
- The dashboard should use `/admin/dashboard/v2` as the primary source for the home screen.

### Day Close modal/history

Files:

- `components/analytics/day-close-modal.tsx`
- `components/analytics/day-close-history.tsx`
- `app/(dashboard)/day-close/page.tsx`

Problems:

- `DayCloseModal` still exposes a manual business date field.
- It calls `/day-closes/current`, `/validate-close`, `/generate-snapshot`, and `/initiate` without `business_line`.
- It fetches orders, expenses, and tables and derives day-close totals client-side.
- That client-side reconstruction is now wrong because backend uses exact windows, scoped business lines, payment instruments, credit settlements, paid vs pending purchases, and expense `created_at`.
- History does not filter by `business_line`.
- History/detail does not clearly show `period_start_at` to `period_end_at`.
- Hotel Close is not available as a separate close flow.

### Checkout and payments

File: `app/(dashboard)/orders/[id]/checkout/page.tsx`

Problems:

- Single payment flow exists.
- Payment instruments for `card` and `digital` exist, which is good.
- Multi-payment UI is missing.
- Split bill/guest bill UI is missing.
- The current screen cannot create multiple payment rows in one guided flow.

### Change Table merge and multi-table assignment

Files currently showing the gap:

- `app/(dashboard)/orders/new/page.tsx`
- `app/(dashboard)/orders/[id]/page.tsx`
- `components/orders/pos-system.tsx`
- `lib/api/endpoints.ts`

Current status:

- Flutter Change Table can merge into another occupied/bill-printed table.
- Backend supports this with `POST /orders/{guest_order_id}/guest-bills/transfer-table`.
- Web order detail "Change Table" only allows selecting free/available tables today, so it misses the merge path.
- Backend order schemas support `table_ids`.
- Web reservation forms already send `table_ids`, so the concept exists in web but not in POS table order flows.
- Web new-order table flow still selects a single table.
- There is no clear POS action for assigning multiple tables to one new order.

Important distinction:

- Change Table merge means moving the source bill into an already occupied table's active order.
- Multi-table assignment means one order/session uses multiple physical tables through `table_ids`.
- These are related table workflows, but they are not the same endpoint and not the same data behavior.

### Transactions

File: `app/(dashboard)/transactions/page.tsx`

Problems:

- `payment_user_id` filter is missing.
- "Payment Added By" user selector is missing.
- Selecting payment user should force `types=["order"]`.
- Order cards/rows should open the order detail/history detail screen, not the transaction detail screen.
- Current UI is table-like and does not match the newer minimal card treatment used in Flutter.

### Finance income

File: `app/(dashboard)/finance/income/page.tsx`

Current status:

- It already calls `/income/dashboard`.
- It already passes `business_line`.
- It renders `by_payment_instrument`.

Remaining work:

- Confirm "All stations" omits `station`.
- Align payment method widget with analytics/income shared component.
- If web needs day-close-session filtering on this screen too, backend does not currently expose `start_time/end_time` for `/income/dashboard`; use analytics dashboard for exact close windows, or extend backend intentionally.

### Finance expenses

File: `app/(dashboard)/finance/expenses/page.tsx`

Remaining work:

- Ensure list and summary calls pass `business_line`.
- Expense create/edit must send `business_line`.
- Hotel module must default to `business_line=hotel`.
- Add payment-method breakdown section if not already present.
- Use the same visual section as income payment methods, but label/amount it as expense breakdown.
- MVP parity can group the loaded expense rows by `payment_method` like Flutter does.
- If the web expense list is paginated, do not aggregate only the visible page. Either load the complete filtered expense set for the breakdown or add a backend aggregate endpoint before claiming totals are accurate.
- Do not treat date/time client filters as exact close windows unless backend supports exact times for that endpoint.

### General purchases

Files likely involved:

- `app/(dashboard)/manage/purchases/page.tsx`
- `components/manage/purchases/*`
- `lib/api/endpoints.ts`

Remaining work:

- `GeneralPurchaseApis.list` must accept `businessLine`.
- Create/update payloads must send `business_line`.
- Hotel module must default purchases to `hotel`.
- Restaurant module must default purchases to `restaurant`.
- Paid purchases affect close totals.
- Pending purchases are informational in close reports and do not affect financial totals.

## Backend API Contracts To Implement In Web

All backend responses are wrapped:

```json
{
  "status": "success",
  "message": "Human readable message",
  "data": {}
}
```

### Dashboard V2

Endpoint:

```http
GET /admin/dashboard/v2
```

Query params:

```text
restaurant_id: number
date?: YYYY-MM-DD
start_time?: UTC ISO datetime
end_time?: UTC ISO datetime
timezone?: IANA timezone, example Asia/Kathmandu
business_line?: restaurant | hotel
```

Example:

```http
GET /admin/dashboard/v2?restaurant_id=52&timezone=Asia/Kathmandu&business_line=restaurant
```

Response shape:

```json
{
  "meta": {
    "restaurant_id": 52,
    "outlet_name": "Yummy",
    "currency": "NPR",
    "timezone": "Asia/Kathmandu",
    "from_time": "2026-06-01T18:15:00Z",
    "to_time": "2026-06-02T18:14:59Z",
    "generated_at": "2026-06-02T03:30:00Z",
    "access_level": "full",
    "access_note": null
  },
  "home": {
    "shift_pulse": {
      "available": true,
      "active_orders": 0,
      "kot_pending": 0,
      "kot_delayed": 0,
      "cancelled": 0,
      "refunded": 0
    },
    "action_queue": {
      "available": true,
      "delayed_kots": 0,
      "oldest_active_order_minutes": 0,
      "stale_open_orders": 0,
      "stale_oldest_order_minutes": 0,
      "credit_orders_unsettled": 0,
      "refunds_pending": 0,
      "high_cancellation": 0
    },
    "cash_watch": {
      "available": true,
      "cash_collected": 180,
      "digital_collected": 280,
      "credit_sales": 880,
      "total_outstanding": 3550
    },
    "quick_actions": { "available": true, "items": [] },
    "attention_items": { "available": true, "items": [] },
    "active_orders_preview": { "available": true, "items": [] },
    "pipeline": { "available": true, "status_counts": [], "aging_buckets": {} },
    "throughput": { "available": true, "comparison_basis": "previous_period", "points": [] },
    "top_items_live": { "available": true, "items": [] },
    "occupancy": { "available": true, "occupied_tables": 0, "free_tables": 0, "occupied_rooms": 0, "free_rooms": 0 },
    "reservations_today": { "available": true, "pending_count": 0, "confirmed_count": 0, "items": [] },
    "day_close_status": { "available": true, "status": "not_started", "route": "/day-close", "action_label": "Open Day Close" },
    "alerts": { "available": true, "items": [] },
    "quick_insights": { "available": true, "items": [] },
    "tutorial_video": null
  }
}
```

Delta endpoint:

```http
GET /admin/dashboard/v2/delta?restaurant_id=52&since=2026-06-02T03:30:00Z&business_line=restaurant&timezone=Asia/Kathmandu
```

Response:

```json
{
  "changed": true,
  "last_updated": "2026-06-02T03:31:00Z",
  "updates": {
    "meta": null,
    "home": {}
  }
}
```

Implementation notes:

- Use `home.shift_pulse` for Live Status.
- Use `home.cash_watch` for Money Snapshot.
- Use `home.quick_actions.items` or current static actions, but prefer backend enabled/disabled state.
- Use `home.day_close_status` to route to Restaurant Close or Hotel Close.
- Use `home.attention_items` and `home.alerts` for warning cards.

### Analytics Dashboard

Endpoint:

```http
GET /analytics/dashboard
```

Query params:

```text
restaurant_id: number
date_from?: YYYY-MM-DD
date_to?: YYYY-MM-DD
start_time?: UTC ISO datetime
end_time?: UTC ISO datetime
timezone?: IANA timezone
station?: kitchen | bar | cafe
business_line?: restaurant | hotel
```

Date-range example:

```http
GET /analytics/dashboard?restaurant_id=52&date_from=2026-06-01&date_to=2026-06-01&timezone=Asia/Kathmandu&business_line=restaurant&station=bar
```

Day-close-session example:

```http
GET /analytics/dashboard?restaurant_id=52&start_time=2026-06-01T17:55:00Z&end_time=2026-06-03T14:30:00Z&timezone=Asia/Kathmandu&business_line=restaurant
```

Response shape:

```json
{
  "meta": {
    "restaurant_id": 52,
    "timezone": "Asia/Kathmandu",
    "date_range": { "from": "2026-06-01", "to": "2026-06-01" },
    "generated_at": "2026-06-02T03:30:00Z",
    "currency": "NPR"
  },
  "tabs": {
    "overview": {
      "today_snapshot": { "available": true, "income": 1340, "expense": 0 },
      "executive_summary": { "available": true, "metrics": [] },
      "health_trends": { "available": true, "labels": [], "revenue": [], "orders": [], "expense": [], "profit": [] },
      "revenue_trends": { "available": true, "labels": [], "revenue": [], "orders": [], "expense": [], "profit": [] },
      "payment_mix": {
        "available": true,
        "items": [{ "label": "cash", "amount": 180 }],
        "income_by_payment_instrument": [{ "label": "Digital - Babk", "amount": 3548 }]
      },
      "table_utilization": { "available": true, "total_tables": 0, "tables_used": 0, "items": [], "tables": [] },
      "alert_insights": { "available": true, "items": [] }
    },
    "finance": {
      "pnl_summary": { "available": true, "metrics": [] },
      "income_vs_expense": { "available": true, "labels": [], "revenue": [], "orders": [], "expense": [], "profit": [] },
      "cashflow_timeline": { "available": true, "labels": [], "revenue": [], "orders": [], "expense": [], "profit": [] },
      "receivables": { "available": true, "credit_sales": 0, "total_outstanding": 0, "credit_orders_count": 0 },
      "expense_by_category": { "available": true, "items": [] },
      "expense_by_vendor": { "available": true, "items": [] },
      "payment_settlement_mix": { "available": true, "items": [], "income_by_payment_instrument": [] }
    },
    "orders": {
      "live_pipeline": { "available": true, "completed": 0, "pending": 0, "delayed": 0, "canceled": 0 },
      "outcome_summary": { "available": true, "metrics": [] },
      "source_mix": { "available": true, "total_orders": 0, "total_amount": 0, "items": [] },
      "top_selling_items": { "available": true, "items": [] },
      "top_selling_tables": { "available": true, "items": [] },
      "top_customers": { "available": true, "items": [] },
      "service_time_distribution": { "available": true, "items": [] }
    },
    "menu": {
      "performance_summary": { "available": true, "metrics": [] },
      "top_items": { "available": true, "items": [] },
      "low_items": { "available": true, "items": [] },
      "category_performance": { "available": true, "items": [] },
      "all_items": { "available": true, "items": [] },
      "stock_status": { "available": true }
    },
    "staff": {
      "productivity_summary": { "available": true, "metrics": [] },
      "top_performer": { "available": true, "id": null, "name": null, "revenue": 0, "orders_count": 0 },
      "leaderboard": { "available": true, "items": [] },
      "contribution": { "available": true, "items": [] }
    }
  }
}
```

Implementation notes:

- Replace `lib/analytics-dashboard-mapper.ts` with a mapper built around `data.tabs`.
- Build one payment-method widget that accepts:
  - method rows from `payment_mix.items` or `payment_settlement_mix.items`
  - instrument rows from `income_by_payment_instrument`
- For card/digital, display instrument names under the method section.
- Do not fall back to order-completion totals for discount/payment figures.

### Analytics drilldowns

Endpoints:

```http
GET /analytics/menu/details
GET /analytics/staff/details
GET /analytics/kitchen/details
GET /analytics/inventory/details
```

Common params:

```text
restaurant_id
date_from
date_to
timezone?
page?
page_size?
business_line?
```

Additional params:

- Menu: `sort_by`, `sort_dir`, `search`, `category`
- Inventory: `view=item|category`

Implementation notes:

- Add `businessLine` to `AnalyticsApis.inventoryDetails`.
- If the page is filtered by a day-close session, decide whether drilldowns need exact `start_time/end_time`. Current drilldown helpers and backend schemas are date-based. Do not pretend they are exact-window unless backend is extended.

### Day Close sessions for analytics filters

Endpoint:

```http
GET /day-closes/sessions
```

Query params:

```text
restaurant_id: number
business_line?: restaurant | hotel
skip?: number
limit?: number
```

Example:

```http
GET /day-closes/sessions?restaurant_id=52&business_line=restaurant&skip=0&limit=50
```

Response:

```json
[
  {
    "id": 101,
    "business_date": "2026-06-03",
    "business_line": "restaurant",
    "confirmed_at": "2026-06-03T14:30:00Z",
    "period_start_at": "2026-06-01T17:55:00Z",
    "period_end_at": "2026-06-03T14:30:00Z"
  }
]
```

Analytics filter behavior:

- Add a "Day Close" or "Daybook" selector.
- Load sessions from this endpoint.
- When a session is selected:
  - Store `selectedSession`.
  - Set analytics query to `start_time=period_start_at` and `end_time=period_end_at`.
  - Keep `business_line` consistent with the session.
  - Clear station unless station-in-session filtering is explicitly supported for the selected report.
  - Show label: `Daybook: Jun 3, 2026`.
  - Show helper text: `Covers Jun 1, 11:40 PM - Jun 3, 8:15 PM`.
- When date range, business line, or station is manually changed:
  - Clear selected day-close session.

### Day Close current/validate/snapshot/initiate/confirm

Current close:

```http
GET /day-closes/current?restaurant_id=52&business_line=restaurant
GET /day-closes/current?restaurant_id=52&business_line=hotel
```

Validate:

```http
GET /day-closes/validate-close?restaurant_id=52&business_line=restaurant
```

Snapshot preview:

```http
GET /day-closes/generate-snapshot?restaurant_id=52&business_line=restaurant
```

Initiate:

```http
POST /day-closes/initiate
```

Body:

```json
{
  "restaurant_id": 52,
  "business_line": "restaurant"
}
```

Confirm:

```http
POST /day-closes/{id}/confirm
```

Body:

```json
{
  "actual_cash": 1234.5,
  "confirmation_notes": "Optional note"
}
```

Important:

- Keep `business_date` optional for compatibility only.
- Do not let users choose a business date as the accounting boundary.
- On confirm, backend revalidates and regenerates final snapshot at the actual confirmation time.

Day close detail response fields:

```json
{
  "id": 101,
  "restaurant_id": 52,
  "business_date": "2026-06-03",
  "business_line": "restaurant",
  "period_start_at": "2026-06-01T17:55:00Z",
  "period_end_at": "2026-06-03T14:30:00Z",
  "status": "confirmed",
  "total_orders": 12,
  "completed_orders": 11,
  "canceled_orders": 1,
  "gross_sales": 5000,
  "discount_total": 100,
  "tax_total": 0,
  "service_charge_total": 0,
  "net_sales": 4900,
  "cash_sales": 1000,
  "card_sales": 500,
  "digital_sales": 2500,
  "fonepay_sales": 0,
  "credit_sales": 900,
  "credit_collections": 300,
  "manual_cash_income": 0,
  "outstanding_receivables": 3550,
  "expense_count": 2,
  "expense_total": 400,
  "refund_count": 0,
  "refund_total": 0,
  "expected_cash": 1300,
  "actual_cash": 1300,
  "cash_discrepancy": 0,
  "net_cash_position": 1300,
  "confirmed_at": "2026-06-03T14:30:00Z",
  "confirmation_notes": null
}
```

### Day Close saved snapshot/report data

Endpoint:

```http
GET /day-closes/{id}/snapshot
```

Response data contains:

```json
{
  "snapshot_data": {
    "period_start_at": "2026-06-01T17:55:00Z",
    "period_end_at": "2026-06-03T14:30:00Z",
    "business_date": "2026-06-03",
    "business_line": "restaurant",
    "hotel_revenue_split": {
      "room_revenue": 0,
      "food_revenue": 0
    },
    "sales_by_channel": {},
    "sales_by_category": {},
    "hourly_sales": [],
    "top_items": [],
    "payment_distribution": {
      "cash": { "count": 1, "amount": 180 },
      "card": { "count": 1, "amount": 150 },
      "digital": { "count": 1, "amount": 3548 },
      "fonepay": { "count": 0, "amount": 0 },
      "credit": { "count": 1, "amount": 680 }
    },
    "payment_instrument_distribution": [
      { "method": "card", "instrument": "Nabil", "count": 1, "amount": 150 },
      { "method": "digital", "instrument": "Babk", "count": 1, "amount": 3548 }
    ],
    "card_sales_by_instrument": {
      "Nabil": 150
    },
    "digital_sales_by_instrument": {
      "Babk": 3548
    },
    "credit_settlement": {
      "customers_count": 1,
      "orders_count": 1,
      "amount": 680,
      "orders": [
        {
          "order_id": 1153,
          "restaurant_order_id": 11,
          "customer_name": "Customer Name",
          "table_name": "Table 99",
          "channel": "table",
          "status": "completed",
          "grand_total": 1340,
          "credit_amount": 680,
          "payment_methods": ["cash", "credit"],
          "created_at": "2026-06-02T02:00:00Z",
          "completed_at": "2026-06-02T03:00:00Z"
        }
      ]
    },
    "orders": [],
    "expense_breakdown": {},
    "expenses": [],
    "paid_purchase_total": 0,
    "paid_purchase_count": 0,
    "pending_purchase_total": 0,
    "pending_purchase_count": 0,
    "manual_income_total": 0,
    "manual_cash_income": 0,
    "manual_income_by_method": {},
    "manual_income_entries": [],
    "cash_expense_total": 0,
    "operational_snapshot": {
      "total_orders": 0,
      "completed_orders": 0,
      "canceled_orders": 0,
      "avg_order_value": 0,
      "avg_items_per_order": 0,
      "channel_breakdown": {}
    },
    "receivables": {
      "credit_sales": 680,
      "credit_orders_count": 1,
      "credit_collections": 0,
      "cash_credit_collections": 0,
      "credit_collections_by_method": {},
      "outstanding_receivables": 3550
    },
    "refunds": {
      "count": 0,
      "total": 0,
      "cash_refunds": 0,
      "card_refunds": 0,
      "digital_refunds": 0,
      "fonepay_refunds": 0,
      "entries": []
    }
  }
}
```

Report implementation requirements:

- Payment Methods:
  - Show method totals from `payment_distribution`.
  - Under Card and Digital, show instrument rows from `payment_instrument_distribution`.
  - Fallback maps `card_sales_by_instrument` and `digital_sales_by_instrument` are available.
- Credit Settlements:
  - Show `credit_settlement.amount`, `orders_count`, `customers_count`.
  - Show each credit order card from `credit_settlement.orders`.
  - For multi-payment orders, show `grand_total` and exact `credit_amount` separately.
  - Make each credit order card clickable and open that order detail.
- Hotel Close:
  - Show `hotel_revenue_split.room_revenue`.
  - Show `hotel_revenue_split.food_revenue`.
- Purchases:
  - Paid purchases affect financial close totals.
  - Pending purchases should be shown separately and not treated as closed expense.
- Expenses:
  - Use backend `expenses` and `expense_breakdown`.
  - Do not fetch `/expenses` separately to patch totals.

### Day Close list/history

Endpoint:

```http
GET /day-closes
```

Query params:

```text
restaurant_id?: number
business_line?: restaurant | hotel
status?: pending | confirmed | reopened | canceled
date_from?: YYYY-MM-DD
date_to?: YYYY-MM-DD
skip?: number
limit?: number
```

Example:

```http
GET /day-closes?restaurant_id=52&business_line=restaurant&status=confirmed&date_from=2026-06-01&date_to=2026-06-30&skip=0&limit=50
```

Implementation notes:

- History filters by close date, not covered data date.
- Add business-line switch or separate Restaurant Close / Hotel Close entry.
- Each card should display:
  - Close label: `Restaurant Close - Jun 3, 2026`
  - Status
  - Net sales / expected cash / actual cash
  - Covered range from `period_start_at` to `period_end_at`

### Transactions

Endpoint:

```http
GET /transactions
```

Query params:

```text
restaurant_id: number
user_id?: number
payment_user_id?: number
types?: order | expense | inventory | manualIncome
date_from?: YYYY-MM-DD
date_to?: YYYY-MM-DD
skip?: number
limit?: number
```

Examples:

```http
GET /transactions?restaurant_id=52&date_from=2026-06-01&date_to=2026-06-02&types=order&skip=0&limit=50
```

```http
GET /transactions?restaurant_id=52&payment_user_id=7&types=order&skip=0&limit=50
```

Response:

```json
{
  "items": [
    {
      "id": "order-1153",
      "type": "order",
      "title": "Order #11",
      "amount": 1340,
      "user_id": 4,
      "user_name": "Niraj Adhikari",
      "created_at": "2026-06-02T03:00:00Z",
      "details": {
        "order_id": 1153,
        "order_number": 11,
        "status": "completed",
        "channel": "table",
        "customer_name": "Customer Name"
      }
    }
  ],
  "total": 1
}
```

Implementation notes:

- Add `paymentUserId` to `TransactionsApis.list`.
- Add "Payment Added By" selector using the same user list as Staff Member.
- If `paymentUserId` is set:
  - Force `types=["order"]`.
  - Disable conflicting non-order type chips or clear them.
- For order transaction rows:
  - Prefer `details.order_id`.
  - Fallback parse `id` like `order-1153`.
  - Navigate to the web completed/order detail route.
- Non-order rows should keep current transaction detail behavior.

### Order payments and instruments

Add payment:

```http
POST /orders/{order_id}/payments
```

Body:

```json
{
  "payment": {
    "method": "digital",
    "amount": 500,
    "reference": "Optional reference",
    "instrument": {
      "type": "static_qr",
      "name": "Babk",
      "meta": {
        "payload": "qr payload or identifier"
      }
    },
    "status": "success",
    "customer_id": null
  }
}
```

Methods:

- `cash`
- `card`
- `digital`
- `fonepay`
- `credit`

Instrument rules:

- Card should send selected card instrument:
  - `instrument.type = "card"`
  - `instrument.name = selected card name`
- Static QR/digital should send selected QR instrument:
  - `instrument.type = "static_qr"`
  - `instrument.name = selected QR name`
- Fonepay dynamic QR can use `reference` from PRN flow and does not need static instrument.
- Credit requires a `customer_id`.

Response:

```json
{
  "payment": {
    "id": 1001,
    "method": "digital",
    "amount": 500,
    "reference": null,
    "instrument_type": "static_qr",
    "instrument_name": "Babk",
    "instrument_meta": { "payload": "..." },
    "instrument": {
      "type": "static_qr",
      "name": "Babk",
      "meta": { "payload": "..." }
    },
    "status": "success",
    "created_at": "2026-06-02T03:30:00Z"
  },
  "order": {},
  "payment_complete": true,
  "table_freed": true,
  "table_id": 99,
  "table_status": "free"
}
```

Update payment:

```http
PATCH /orders/{order_id}/payments/{payment_id}
```

Body:

```json
{
  "payment": {
    "method": "card",
    "reference": "Updated ref",
    "instrument": {
      "type": "card",
      "name": "Nabil",
      "meta": {}
    }
  }
}
```

Remove payment:

```http
DELETE /orders/{order_id}/payments/{payment_id}
```

### Multi-payment checkout

Backend has no separate bulk endpoint. Implement as a web UI flow that creates multiple payments by calling:

```http
POST /orders/{order_id}/payments
```

once per row.

Recommended UI behavior:

- Add a "Multiple Payment" toggle on checkout.
- When enabled, open a dedicated minimal multi-payment panel/screen.
- User can add rows:
  - method
  - amount
  - instrument if card/digital
  - customer if credit
  - reference optional
- After entering amount in one row, show remaining amount immediately.
- Offer "Fill remaining" on another row.
- Validation:
  - Sum must be greater than zero.
  - Sum must not exceed `balance_due`.
  - For completing checkout, sum should equal `balance_due`.
  - Credit row requires customer.
  - Card/digital row should require instrument if restaurant has configured instruments.
- Submit sequentially:
  - POST each payment.
  - If a later payment fails, show which row failed and refetch bill/order state.
  - Do not assume all succeeded.
- After final payment, refetch `/orders/{id}/bill` or `/orders/{id}`.

### Change Table: move to free table or merge into occupied table

This is the behavior currently implemented in Flutter's Change Table screen.

Endpoint:

```http
POST /orders/{guest_order_id}/guest-bills/transfer-table
```

Body:

```json
{
  "destination_table_id": 100
}
```

Response when moved to a free/no-active-order table:

```json
{
  "source_order_id": 1153,
  "destination_order_id": null,
  "destination_table_id": 100,
  "action": "moved",
  "moved_lines": 0,
  "moved_qty": 0
}
```

Response when merged into an occupied table's active order:

```json
{
  "source_order_id": 1153,
  "destination_order_id": 1200,
  "destination_table_id": 100,
  "action": "merged",
  "moved_lines": 3,
  "moved_qty": 5
}
```

Backend behavior:

- Requires `pos.order.transfer`.
- Only table orders can be transferred or merged.
- Source order cannot be completed or canceled.
- Source order cannot already have successful positive payments.
- Source and destination table cannot be the same.
- Source bill must have transferable items.
- If the destination table has no active order, backend moves the source bill to that table and returns `action: "moved"`.
- If the destination table has an active order, backend merges source items into the destination order and returns `action: "merged"`.
- Destination order cannot already have successful positive payments.
- Matching item signatures are merged by increasing quantity; non-matching items are cloned into the destination order.
- Source order is canceled after merge with a cancel reason like `Merged into order #...`.
- Backend syncs old and destination table occupancy after move/merge.

Flutter behavior to copy:

- Current table is not selectable.
- `paymentCompleted` table is not selectable.
- Free table opens a "Move bill to this table?" confirmation.
- Occupied or bill-printed table opens a "Merge bill into this table?" confirmation.
- Confirm button says `Move` or `Merge`.
- After success:
  - `action == "merged"` -> show `Bill merged into {table}.`
  - otherwise -> show `Bill moved to {table}.`
- Emit table refresh / refetch tables and order state.

Current web gap:

- In `app/(dashboard)/orders/[id]/page.tsx`, the change-table dialog only selects tables whose status is `FREE` or `AVAILABLE`.
- That blocks the exact app behavior where occupied/bill-printed tables are valid merge targets.
- `OrderApis` also needs a helper:

```ts
OrderApis.transferGuestBillTable = (guestOrderId: number) =>
  `/orders/${guestOrderId}/guest-bills/transfer-table`
```

### Multi-table assignment with `table_ids`

Backend represents multi-table assignment as one order with multiple assigned table IDs.

Create order with multiple tables:

```http
POST /orders/
```

Body:

```json
{
  "restaurant_id": 52,
  "channel": "table",
  "table_ids": [99, 100, 101],
  "number_of_guests": 12,
  "customer_id": null,
  "customer_name": null,
  "customer_phone": null,
  "items": [
    {
      "menu_item_id": 10,
      "name_snapshot": "Milk Tea",
      "unit_price": 60,
      "qty": 3
    }
  ]
}
```

Update an existing order's assigned tables:

```http
PATCH /orders/{order_id}
```

Body:

```json
{
  "table_ids": [99, 100, 101],
  "number_of_guests": 12
}
```

Response uses the normal `OrderRead` shape. Important fields:

```json
{
  "id": 1153,
  "channel": "table",
  "table_id": 99,
  "table_ids": [99, 100, 101],
  "table_name": "Table 99",
  "number_of_guests": 12,
  "status": "running",
  "items": [],
  "payments": []
}
```

Backend behavior:

- Requires `pos.order.transfer` when updating `table_id`, `table_ids`, or `group_id`.
- First ID in `table_ids` becomes the primary `table_id`.
- Backend validates that every table belongs to the restaurant.
- Backend validates guest count against total capacity of selected tables.
- Backend synchronizes split-child guest bills to the same table assignment when the parent order moves.

Web UI requirements:

- In new order table selection, support multi-select mode:
  - default tap can remain "open/create order for one table"
  - add an explicit "Multi-table" action to enter multi-select
  - show selected table count and total capacity
  - submit selected IDs as `table_ids`
- In order detail/change table, support assigning multiple available tables:
  - label this as "Multi-table assignment" or "Assign tables"
  - allow selecting multiple available tables
  - include current assigned tables as selected by default
  - send `PATCH /orders/{id}` with `table_ids`
- Display multi-table orders clearly:
  - show primary table plus count, for example `Table 99 + 2`
  - show full table list in details
- Do not use `table_ids` to combine two existing active orders.
  - If the destination table is occupied/bill-printed and the user wants to combine bills, use the Change Table endpoint above: `POST /orders/{guest_order_id}/guest-bills/transfer-table`.
  - That merge must be explicit and confirmed by the user.

### Split bill / guest bills

Current backend uses guest bills.

Get guest bill session:

```http
GET /orders/{order_id}/guest-bills
```

Response:

```json
{
  "anchor_order_id": 1153,
  "split_group_id": "uuid-or-null",
  "context_order_ids": [1153, 1154, 1155],
  "orders": [
    {
      "order_id": 1154,
      "split_label": "Guest 1",
      "split_sequence": 1,
      "status": "running",
      "items_count": 2,
      "grand_total": 500,
      "total_paid": 0,
      "balance_due": 500,
      "is_fully_paid": false,
      "table_id": 99
    }
  ]
}
```

Split bill:

```http
POST /orders/{order_id}/split-bill
```

Body:

```json
{
  "source_order_id": 1153,
  "parts": [
    {
      "label": "Guest 1",
      "lines": [
        { "order_item_id": 501, "qty": 1 }
      ]
    },
    {
      "label": "Guest 2",
      "lines": [
        { "order_item_id": 502, "qty": 2 }
      ]
    }
  ],
  "keep_unassigned_in_parent": true
}
```

Response:

```json
{
  "parent_order_id": 1153,
  "split_group_id": "uuid",
  "parent_bill": {},
  "children": [
    {
      "order_id": 1154,
      "split_label": "Guest 1",
      "split_sequence": 1,
      "grand_total": 500,
      "total_paid": 0,
      "balance_due": 500,
      "status": "running"
    }
  ]
}
```

Pay all guest bills:

```http
POST /orders/{parent_order_id}/guest-bills/pay-all
```

Body:

```json
{
  "method": "cash",
  "reference": "Optional ref"
}
```

Transfer items:

```http
POST /orders/{parent_order_id}/guest-bills/transfer-item
```

Body:

```json
{
  "from_order_id": 1154,
  "to_order_id": 1155,
  "lines": [
    { "order_item_id": 501, "qty": 1 }
  ]
}
```

Merge guest bills:

```http
POST /orders/{parent_order_id}/guest-bills/merge
```

Body:

```json
{
  "from_order_id": 1154,
  "to_order_id": 1155
}
```

Cancel split:

```http
POST /orders/{parent_order_id}/guest-bills/cancel-split
```

Transfer guest bill to table:

```http
POST /orders/{guest_order_id}/guest-bills/transfer-table
```

Body:

```json
{
  "destination_table_id": 100
}
```

Implementation notes:

- Add split bill button in checkout/bill screen.
- Show current guest bills when an order has `split_group_id`, `is_split_parent`, or `is_split_child`.
- Each child bill should open its own bill/payment view.
- Payment on each guest bill uses the same `/orders/{child_order_id}/payments` endpoint.

### Income dashboard

Endpoint:

```http
GET /income/dashboard
```

Query params:

```text
restaurant_id: number
date_from: YYYY-MM-DD
date_to: YYYY-MM-DD
timezone?: IANA timezone
station?: kitchen | bar | cafe
business_line?: restaurant | hotel
```

Response:

```json
{
  "summary": {
    "total_net_income": 720,
    "gross_sales": 720,
    "total_tax": 0,
    "total_discount": 0,
    "refund_total": 0,
    "refunded_orders_count": 0
  },
  "by_source": [
    { "source": "dine_in", "amount": 720, "percentage": 1 }
  ],
  "by_payment_method": [
    { "method": "cash", "amount": 0, "percentage": 0 },
    { "method": "card", "amount": 150, "percentage": 0.04 },
    { "method": "digital", "amount": 3548, "percentage": 0.96 }
  ],
  "by_payment_instrument": [
    { "method": "card", "instrument": "Nabil", "amount": 150, "percentage": 0.04 },
    { "method": "digital", "instrument": "Babk", "amount": 3548, "percentage": 0.96 }
  ],
  "recent": [],
  "receivables": {
    "credit_sales": 30,
    "total_outstanding": 2670,
    "credit_orders_count": 1
  }
}
```

Implementation notes:

- Payment method UI should show instrument rows, not only method buckets.
- If selected station is all, omit `station`.
- Use `business_line=restaurant` by default in Restaurant context.

### Expenses

List:

```http
GET /expenses/
```

Query params:

```text
restaurant_id
category_id?
payment_method?
vendor?
date_from?
date_to?
timezone?
station?
business_line?
source_type?
skip?
limit?
```

Summary:

```http
GET /expenses/summary/total
```

Query params:

```text
restaurant_id
filter? daily | weekly | monthly
category_id?
date_from?
date_to?
timezone?
station?
business_line?
source_type?
```

Create:

```http
POST /expenses/
```

Body:

```json
{
  "restaurant_id": 52,
  "category_id": 10,
  "business_line": "hotel",
  "amount": 500,
  "description": "Laundry",
  "vendor": "Vendor name",
  "payment_method": "cash",
  "paid_on": "2026-06-02",
  "station": "rooms",
  "source_type": "manual_entry"
}
```

Expense categories:

```http
GET /expenses/categories?restaurant_id=52&business_line=hotel
POST /expenses/categories
PATCH /expenses/categories/{category_id}
DELETE /expenses/categories/{category_id}
```

Implementation notes:

- Hotel expense screens must default to `business_line=hotel`.
- Restaurant expense screens must default to `business_line=restaurant`.
- Expense payment-method breakdown should use the same visual component as income payment methods, but with expense amounts.
- Flutter currently derives the expense payment-method section from loaded expense rows:
  - group by normalized `payment_method`
  - sum `amount`
  - percentage = method total / total filtered expenses
- Web must not calculate that breakdown from only the current paginated page.
- If web keeps paginated expenses, either request a complete filtered set for the breakdown or add/consume a backend aggregate such as `by_payment_method` on the expense summary endpoint.

### General purchases

List:

```http
GET /general-purchases?restaurant_id=52&business_line=hotel&status=received&skip=0&limit=100
```

Create:

```http
POST /general-purchases
```

Body:

```json
{
  "restaurant_id": 52,
  "supplier_id": 1,
  "business_line": "hotel",
  "purchase_name": "Room supplies",
  "unit": "pcs",
  "purchased_date": "2026-06-02",
  "total_cost": 2500,
  "payment_status": "pending",
  "payment_method": null,
  "status": "received",
  "notes": "Optional"
}
```

Update:

```http
PATCH /general-purchases/{id}
```

Body can include:

```json
{
  "business_line": "hotel",
  "payment_status": "paid",
  "payment_method": "cash",
  "status": "received"
}
```

Other actions:

```http
POST /general-purchases/{id}/receive
POST /general-purchases/{id}/cancel
POST /general-purchases/{id}/return
DELETE /general-purchases/{id}
GET /awaiting-payments/general?restaurant_id=52
```

Implementation notes:

- Add `businessLine` query support in `GeneralPurchaseApis.list`.
- Add `business_line` in create/update forms.
- Hotel purchases should appear in Hotel Close only when `business_line=hotel`.
- Paid purchases affect close totals.
- Pending purchases are shown separately.

## Screen Implementation Plan

### 1. Update API helper layer first

Implement these helpers before screen work:

```ts
DayCloseApis.current({ restaurantId, businessLine })
DayCloseApis.validateClose({ restaurantId, businessLine })
DayCloseApis.generateSnapshot({ restaurantId, businessLine })
DayCloseApis.sessions({ restaurantId, businessLine, skip, limit })
DayCloseApis.list({ restaurantId, businessLine, start, end, status, skip, limit })

TransactionsApis.list({ restaurantId, userId, paymentUserId, types, dateFrom, dateTo, skip, limit })

OrderApis.getGuestBills(orderId)
OrderApis.splitBill(orderId)
OrderApis.payAllGuestBills(parentOrderId)
OrderApis.transferGuestBillItem(parentOrderId)
OrderApis.mergeGuestBills(parentOrderId)
OrderApis.cancelGuestBillSplit(parentOrderId)
OrderApis.transferGuestBillTable(guestOrderId)
OrderApis.updateOrder(orderId) // send table_ids for multi-table assignment

GeneralPurchaseApis.list({ restaurantId, businessLine, status, skip, limit })

DashboardApis.dashboardDataV2({ restaurantId, date, startTime, endTime, timezone, businessLine })
DashboardApis.dashboardDelta({ restaurantId, since, timezone, businessLine, date, startTime, endTime })
```

### 2. Replace analytics mapper

Build a new mapper around:

```ts
response.data.meta
response.data.tabs.overview
response.data.tabs.finance
response.data.tabs.orders
response.data.tabs.menu
response.data.tabs.staff
```

Remove dependence on old:

```ts
data.overview
data.kpis
data.comparison
data.trends_chart
data.breakdown
data.menu_snapshot
```

### 3. Implement day-close session filter in analytics

Required state:

```ts
businessLine: "restaurant" | "hotel"
station?: "kitchen" | "bar" | "cafe"
dateFrom?: string
dateTo?: string
selectedDayCloseSession?: {
  id: number
  business_date: string
  business_line: "restaurant" | "hotel"
  period_start_at: string
  period_end_at: string
  confirmed_at: string
}
```

Query logic:

```ts
if (selectedDayCloseSession) {
  use start_time = selectedDayCloseSession.period_start_at
  use end_time = selectedDayCloseSession.period_end_at
  use business_line = selectedDayCloseSession.business_line
} else {
  use date_from/date_to
  use selected business_line
}
```

UI behavior:

- Selector label when none is selected: `Daybook: All`.
- Selector label when selected: day-close close date.
- Helper/sublabel should show exact covered range.
- Session selection should clear station filter, matching Flutter behavior.

### 4. Fix day-close flow

Restaurant close:

- Pass `business_line=restaurant`.
- Label screen as Restaurant Close or Day Close depending product decision.
- Remove business date override.

Hotel close:

- Add entry inside Hotel module.
- Pass `business_line=hotel`.
- Label as Hotel Close.
- Show room revenue and food revenue.

Both:

- Use backend snapshot only.
- Show exact covered range.
- Show payment methods and instruments.
- Show credit settlements with clickable order cards.

### 5. Implement multi-payment checkout

Add multi-payment toggle and screen/panel.

Submit strategy:

```ts
for (const row of paymentRows) {
  await apiClient.post(OrderApis.addPayment(orderId), {
    payment: row
  })
}
```

After submit:

- Refetch bill.
- Refetch order.
- If order is ready and fully paid, show completion action in the same bottom action shape as Paid.

### 6. Implement split bill / guest bill flow

Minimum viable flow:

- Button: Split bill.
- Dialog/screen:
  - show items and quantities
  - allow creating guest parts
  - submit `POST /orders/{id}/split-bill`
- After split:
  - show guest bill cards from `GET /orders/{id}/guest-bills`
  - allow opening each guest bill checkout
  - allow merge/cancel/transfer actions later if needed

### 7. Implement Change Table move/merge

Minimum viable flow:

- In existing order detail, upgrade "Change Table" so it can select:
  - free/available table -> move bill
  - occupied/bill-printed table -> merge bill
- Use `POST /orders/{guest_order_id}/guest-bills/transfer-table` with `{ destination_table_id }`.
- Before merging into an occupied/bill-printed table, show an explicit confirmation:
  - explain that the source bill will be merged into the destination table's active order
  - use "Merge" as the destructive/action label
- Handle response:
  - `action="moved"` -> source bill moved to free table
  - `action="merged"` -> source bill items moved into destination order and source order canceled
- Refresh order detail, active orders, table occupancy, and KOT/table state after success.
- Show backend validation messages when merge is blocked by successful positive payments or split-parent selection rules.

### 8. Implement multi-table assignment

Minimum viable flow:

- In new order table view, add a "Multi-table" mode.
- Let user select multiple available tables.
- Show selected table count and total capacity.
- Create order with `table_ids`.
- In existing order detail, add an explicit "Assign Tables" / "Multi-table" action.
- Include currently assigned tables as selected.
- Save with `PATCH /orders/{id}` and `{ table_ids: [...] }`.
- Show merged table labels consistently in order cards, bill, KOT, and order detail.

### 9. Refresh transactions

Required filter UI:

- Date range
- Staff Member -> sends `user_id`
- Payment Added By -> sends `payment_user_id`
- Transaction Type chips

Rules:

- If Payment Added By is selected:
  - Set `types=["order"]`.
  - Disable non-order type selection.
- If Payment Added By is cleared:
  - Restore normal type selection.

Navigation:

- Order transaction -> order detail/history detail screen.
- Non-order transaction -> current transaction detail UI.

### 10. Fix hotel ownership in expenses and purchases

Where user is inside hotel module:

- Expense create: `business_line=hotel`
- Expense category create: `business_line=hotel`
- General purchase create: `business_line=hotel`
- General purchase list: `business_line=hotel`

Where user is inside restaurant module:

- Default `business_line=restaurant`.

Expense payment-method section:

- Reuse the same payment-method visual component as income.
- Feed it expense totals grouped by `payment_method`.
- Ensure the totals are based on the full filtered expense result, not only the visible page.

## Suggested Implementation Order

Do not start with UI polish. Start with contract correctness.

1. API helper updates.
2. TypeScript models for new dashboard, analytics, day-close session, day-close snapshot, transactions.
3. Analytics response mapper rewrite.
4. Day-close session filter in analytics.
5. Day-close modal/history scope and exact-window fixes.
6. Hotel Close entry and report sections.
7. Transactions `payment_user_id` filter and order navigation.
8. Checkout multi-payment.
9. Split bill/guest bill flow.
10. Change Table move/merge into occupied table.
11. Multi-table assignment with `table_ids`.
12. Expense payment-method breakdown and expense/purchase business-line ownership fixes.
13. Visual cleanup and shared components.

## Acceptance Tests

### Restaurant vs hotel scope

- Restaurant analytics excludes `room_service` and `business_line=hotel` orders.
- Hotel analytics includes hotel orders.
- Restaurant Close excludes hotel orders.
- Hotel Close includes hotel orders.
- Hotel Close splits `room_revenue` and `food_revenue`.

### Day close exact window

- Close A at Jun 1 23:40.
- Close B at Jun 3 20:15.
- Close B includes only data in `(Jun 1 23:40, Jun 3 20:15]`.
- History card says the exact covered range.
- Multiple closes on same calendar date are listed separately.

### Analytics day-close session filter

- Analytics loads sessions from `/day-closes/sessions` with the selected `business_line`.
- Selecting a session sends `start_time=period_start_at` and `end_time=period_end_at`.
- Selecting a hotel session sends `business_line=hotel`; selecting restaurant sends `business_line=restaurant`.
- Selecting a session clears station filter unless station-in-session filtering is explicitly supported.
- Clearing session restores normal date-range analytics.

### Payment instruments

- Add card payment with selected card instrument.
- Add digital payment with selected QR instrument.
- Analytics payment section shows card/digital instrument names.
- Day-close report shows the same instrument names and amounts.

### Expense payment methods

- Expense screen shows a payment-method breakdown section.
- Breakdown rows use expense amounts, not income amounts.
- Filtering by date/business line/station/source/payment method updates the breakdown.
- If web list is paginated, payment-method totals still match the full filtered result.

### Credit settlements

- Add an order with mixed cash + credit.
- Day-close credit settlement card shows:
  - full `grand_total`
  - exact `credit_amount`
  - payment methods list
  - customer name
- Clicking card opens the order detail.

### Multi-payment

- Add two payment rows.
- Remaining amount updates after first row.
- Submit creates two backend payments.
- Analytics/day-close later reflect both payment methods/instruments.

### Change Table move/merge

- Select a free/available destination table.
- Request uses `POST /orders/{guest_order_id}/guest-bills/transfer-table`.
- Response has `action="moved"` and source order now belongs to the destination table.
- Select an occupied/bill-printed destination table.
- UI shows explicit merge confirmation before request.
- Response has `action="merged"` and includes `destination_order_id`.
- Destination order totals/items include the moved source items.
- Source order is canceled/closed as merged.
- Merge is blocked when source or destination already has successful positive payments.
- Tables, active orders, KOT, and order detail refresh after success.

### Multi-table assignment

- Create a table order with `table_ids=[tableA, tableB]`.
- Response includes `table_id=tableA` and `table_ids=[tableA, tableB]`.
- Both tables display as occupied/attached to the same order.
- Existing order can add/remove assigned tables through `PATCH /orders/{id}`.
- Guest count validation uses combined table capacity.
- Split-bill children keep the same assigned tables when the parent order is moved.
- UI never silently combines two active orders through `table_ids`.

### Transactions

- Staff Member filter sends `user_id`.
- Payment Added By filter sends `payment_user_id`.
- Payment Added By forces type to `order`.
- Pagination keeps `payment_user_id`.
- Order rows open order detail.
- Expense/manual/inventory rows still open transaction detail.

## Mentor Notes

- Do not treat web parity as "make screens look like Flutter screenshots". That will miss the main issue. The main issue is financial contract drift.
- Do not rebuild day-close numbers in the browser. This creates mismatches and makes audits impossible.
- Do not default analytics to "All Services" if the product expectation is Restaurant analytics. "All" is a separate reporting mode, not the default restaurant view.
- Do not hide payment instruments under a generic Digital/Card total. The whole reason the backend changed was to make specific QR/card settlement visible.
- Keep split bill and multi-payment separate. Split bill creates separate guest bills/orders. Multi-payment only splits payment methods for one bill.
- Do not collapse Change Table merge and `table_ids` into one implementation. Change Table merge combines bills through `guest-bills/transfer-table`; `table_ids` assigns multiple physical tables to one order.
