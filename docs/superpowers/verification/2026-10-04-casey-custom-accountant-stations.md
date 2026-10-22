# Live Casey custom-role and station audit

Account: Casey (user 505), restaurant 52. Local only; no commit/push.

## Real assignments tested
- Created disposable custom role 68 combining the backend accountant template (29 permissions) with pos.view, pos.order.create, pos.order.edit, menu.view. Assigned it to Casey. Actual UI displayed the custom role rather than cashier/waiter.
- Kitchen template: six effective permissions. Dashboard, Orders, Menu, Tables and Kitchen navigation visible; no Finance/Analytics. Today had no kitchen tickets.
- Strict station.kitchen.view only: only station navigation; no dashboard stats. Backend ticket search requires pos.view too, so this configuration cannot load tickets.
- Bar template: six permissions. Bar ticket KOT 7-1 visible with Start Cooking/Reject; no kitchen/cafe selector after fix.
- Strict station.bar.view only: no unrelated navigation; backend search denied. Added explicit access explanation and suppressed ticket requests/actions for the missing pos.view prerequisite.
- Combined station.kitchen.view + station.bar.view + pos.view: desktop All/Kitchen/Bar only, mobile selector All/Kitchen/Bar only, no Cafe. Bar ticket visible with operational controls.

## Custom role UI evidence
- Orders list and New Order open. Existing order 31585 offers Add items and item edit; Checkout absent.
- No dashboard/analytics navigation or navbar statistics.
- Finance and inventory links reflect accountant grants.
- Journal Vouchers loads; New voucher form opens. Cancelled without persisting a journal.
- Accounting link/direct URL redirects to Cash & Banks due to existing unconditional app/(dashboard)/finance/accounting/layout.tsx redirect. Full legacy accounting workspace was NOT validated.
- Payments UI is permitted, but backend responds 403: Finance reports are disabled for this restaurant. Did not enable restaurant feature settings.

## Fixes from this pass
- Kitchen station choices derive from explicit station permissions; All only for multiple accessible stations.
- Avoid inventory station-list request without inventory.stations.view/manage.
- Gate ticket actions/detail item controls on the backend-required pos.view grant.
- Explain missing POS view prerequisite rather than displaying misleading empty tickets.

## Restoration
Restored Casey role waiter, roles [waiter], original 14 effective permissions, original dedicated custom role id 67. Verified exact sorted permission match and custom role id. Removed disposable role 68. No orders, payments, journal vouchers or menu records changed.

## Limits
This is targeted live UI validation, not every possible permission pair. No ticket status mutations or financial postings were performed. Backend feature-disabled reports and the legacy accounting redirect remain separate findings.


# Follow-up: accounting route and finance reports feature

- Removed the unconditional redirect from the accounting layout. The live /finance/accounting route now renders the Accounting overview for Casey's custom accountant role.
- Enabled restaurant 52 `finance_reports_enabled` through PUT /restaurants/52. The setting remains enabled as requested.
- With the temporary custom role, Payments UI loaded 527 records (NPR 753,660.43 collected). Payments, Invoices, Sales Book, and VAT Sales API requests all returned success. No report records were altered.
- The Accounting overview route works, but its health/trial-balance/backfill data requests still return 403 PLAN_FEATURE_LOCKED: `finance.accounting.enabled` is unavailable on the current Pro plan. That is a separate subscription entitlement from `finance_reports_enabled`; it was not changed.
- Restored Casey's waiter role and exact 14 permissions; checked the live backend again. A saved legacy custom_role_id=67 is stale/not present in the restaurant, so the API rejected restoring that id; effective role and all permissions were restored and verified through role + permissions. Finance reports feature stays enabled.
- Frontend check: accounting layout regression test passed; TypeScript check and diff check passed.
