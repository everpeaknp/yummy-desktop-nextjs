# Casey cashier and menu-edit UI verification — 2026-10-04

Local backend user 505 (Casey, UI display name Ramon) was temporarily assigned the actual /roles/built-in cashier template using the authorized admin account. Baseline role and effective grants were saved outside the repository. No credentials or tokens are stored in this report.

## Live scenarios exercised

1. Cashier template alone: role label Cashier; Dashboard, Orders, Analytics, Day Close, Cash Drawers, menu browsing, customers, tables/reservations, and receipts access. No menu add/edit/delete controls. Payment report link absent because cashier template does not grant finance.reports.payments.view. Current cashier template explicitly includes reports.analytics.view; analytics visibility is expected, not inferred from the role name.
2. Cashier plus menu.items.manage: Add Item appears; existing item's action menu contains Edit/Delete. Edit form accepts a changed name and enables Update. Price input and tax control remain disabled without menu.pricing.manage. Changes were cancelled. Category Add/Edit controls remain absent.
3. Cashier plus menu.items.manage, menu.categories.manage, menu.pricing.manage: category Add and Edit controls appear (40 Edit controls on current data), category name form accepts changes, and menu item price input becomes enabled. Category and item form changes were cancelled; no menu records were altered or deleted.
4. Mobile Manage at 390x844: cashier Dashboard, Orders, Analytics, Profile, Manage tabs shown; Finance destinations checked. Cash & Banks wrongly appeared for own-drawer permissions and loaded a denied response; corrected route access and verified only Day Close and Cash Drawers remain in cashier Finance navigation.
5. Cash Drawers live screen opens. No active drawer is configured for this account; operational opening/closing could not be exercised. Existing drawer history is displayed under cashier template's report/day-close grants. No payment, refund, drawer open/count/close, or financial transaction was executed.
6. Baseline restored: backend verifies role waiter, original roles, and all 14 original effective permissions exactly match saved baseline. Live mobile menu after restore has zero Add Item buttons and zero item action menus.

## Bugs fixed locally

- Category editor no longer mounts StationPicker without inventory.stations.view/manage. Station read alone does not enable station creation; creation/edit controls require inventory.stations.manage. Name-only edits omit station_id so the existing assignment remains unchanged. New category creation explains and enforces its station-selection prerequisite (backend requires station_id).
- Cash & Banks route now matches its cash-position/transfer backend read permissions: finance.daybook.view, finance.drawer.transfer.to_safe, finance.cash.transfer.to_bank. Own/any drawer-open grants and safe-disburse alone no longer expose a page whose backend queries they cannot authorize. Separate cashier drawer/day-close destinations remain available.

## Automated verification

Red regression tests reproduced category station-control exposure and own-drawer Cash & Banks route exposure before fixes.
Final focused run: 41 passed across role-permissions, sidebar, category dialog and category page tests. Node menu contract checks: 6 passed. TypeScript passed; git diff --check passed.

## Limits

This validates navigation and form/control behavior under real backend grants, not persisted menu saves or real money transactions. Financial workflows lack an assigned active drawer. It is not a claim of exhaustive coverage of every cashier action. Previous full-suite unrelated hotel inventory/day-close presentation and Vitest Node-test collection failures remain outside this pass.

No commits or pushes. No menu data changes. Temporary test grants restored, browser tab closed, mobile viewport reset.
