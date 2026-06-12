# NC Feature API Handoff

This document explains how the backend NC feature works and how client apps, especially Flutter, should use it.

## What NC Means

`NC` means `non-chargeable`.

If an order item is marked as NC:

- the item still stays in the order
- the item still stays in order operations and KOT flow
- the item is still visible in order, bill, and receipt data
- but the item does **not** contribute to billable totals

Backend stores this as:

- `is_nc: true` on the order item

## Core Backend Behavior

When an item has `is_nc = true`:

- backend sets that item line total to `0`
- subtotal excludes that NC item's financial value
- grand total excludes that NC item's financial value
- bill and receipt still include the item, but it is complimentary

So clients should:

- show the item normally
- show an `NC` badge/chip
- trust backend totals instead of recalculating differently on the client

## Customer Rule

If any order contains at least one NC item:

- a customer must be linked before final completion/payment

Backend allows the NC item to exist on the order, but when completing the order:

- if no customer is linked, backend rejects completion

Client guidance:

- allow item to be marked NC
- before final completion/payment, require customer selection if any item is NC

Recommended user-facing message:

- `A customer is required before completing an NC order.`

## Main Endpoints Relevant to NC

These are the important backend endpoints for the NC feature.

### 1. Get active orders

- `GET /orders/active`

Notes:

- used for order list/running orders
- supports `restaurant_id`
- supports `timezone`
- returned order items may include `is_nc`

### 2. Get order detail

- `GET /orders/{order_id}`

Notes:

- order items may include `is_nc`
- this is where the app should display NC badges on item rows

### 3. Update order items

Use the normal order item mutation routes.

Relevant backend routes in the order module are:

- `PUT /orders/{order_id}/items/bulk-update`
- `PATCH /orders/{order_id}/items/{item_id}`
- `PATCH /orders/{order_id}/items/{item_id}/quantity`
- `DELETE /orders/{order_id}/items/{item_id}`

The primary NC route used by the web flow is:

- `PUT /orders/{order_id}/items/bulk-update`

Client rule:

- if Flutter supports item updates, include `is_nc` in the order item payload when toggling NC

Meaning:

- `is_nc = false` -> normal billable item
- `is_nc = true` -> complimentary item

### 4. Get bill

- `GET /orders/{order_id}/bill`

Notes:

- NC items are still present
- payable totals already exclude NC items
- Flutter should not try to re-add NC value into billing totals

### 5. Get receipt

- `GET /receipts/{order_id}`

Notes:

- receipt/order item data may include `is_nc`
- receipt still shows the item operationally
- totals still exclude NC value

### 6. Complete / payment-related flow

NC affects order completion rules.

Relevant backend routes in the payment/completion path include:

- `POST /orders/{order_id}/payments`
- `PUT /orders/{order_id}/status`
- `POST /orders/{order_id}/force-serve`

Important behavior:

- if any order item is NC and no customer is linked
- backend will reject completion/finalization

Flutter should therefore ensure:

- customer is selected before final completion/payment when NC exists

## How Flutter Should Display NC

### Order detail

If an item has:

- `is_nc: true`

Flutter should:

- show an `NC` chip/badge on the item
- keep the item visible in the ordered items list

### Checkout / bill

Flutter should:

- show NC item as complimentary / non-chargeable
- trust backend subtotal and grand total

Expected behavior:

- NC item appears in the item list
- but payable amount does not increase because of that item

### Receipt / history

If `is_nc` is returned:

- show NC marker on the item

## Analytics Behavior

Backend supports separate NC analytics.

NC should not be treated like normal sales revenue.

### Billable analytics

Backend excludes NC from normal billable revenue logic.

That means:

- sales totals do not grow because of NC
- revenue charts should not treat NC as normal paid sales

### Dedicated NC analytics

Backend provides NC-specific analytics data separately.

The main fields/concepts include:

- `nc_items_count`
- `nc_total_value`
- `nc_orders_count`
- `customers_with_nc_items`
- top NC items
- NC order history

Important meaning:

- `nc_total_value` means the would-have-been billable value
- it is **not** the charged amount
- charged amount for an NC item is still `0`

## Dashboard and Analytics Endpoints for NC

### 1. Dashboard V2

- `GET /admin/dashboard/v2`

NC data may appear under:

- `data.home.nc_summary`

Expected structure:

- `summary.nc_items_count`
- `summary.nc_total_value`
- `summary.nc_orders_count`
- `summary.customers_with_nc_items`
- `top_items`

Note:

- this block may be unavailable in limited mode depending on the user's analytics access

### 2. Analytics dashboard

- `GET /analytics/dashboard`

NC data may appear under:

- `tabs.nc`

Expected sections:

- `summary`
- `top_items`
- `top_customers`
- `trend`
- `recent_orders`

### 3. Deep NC history

- `GET /analytics/nc/orders`

Use this for detailed drilldown.

Expected purpose:

- see which orders had NC items
- see customer linkage
- see NC item rows
- see timestamps and order references

### 4. Related analytics permissions note

Some users may not receive full NC analytics if backend serves dashboard data in limited mode.

This especially affects:

- `GET /admin/dashboard/v2`
- `GET /analytics/dashboard`

If the user lacks analytics/report access, the app should tolerate:

- missing `home.nc_summary`
- missing `tabs.nc`
- or limited fallback dashboard behavior

## Recommended Flutter Implementation Order

### Phase 1

- parse `is_nc` from order item responses
- display NC badge in order detail
- display NC as non-chargeable in bill/receipt views
- enforce customer selection before completion when NC exists

### Phase 2

- allow item-level NC editing by sending `is_nc`
- consume dashboard NC summary
- consume analytics NC tab
- optionally consume `GET /analytics/nc/orders` for detailed history

## Practical Client Rules

1. If `is_nc` is true, show the item as complimentary.
2. Trust backend totals for all billing math.
3. Do not treat NC as normal revenue.
4. Require customer before completion if any NC item exists.
5. Treat NC analytics as a separate reporting area from normal sales analytics.
