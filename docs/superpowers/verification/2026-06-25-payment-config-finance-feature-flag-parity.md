# Payment Config And Finance Feature Flag Parity

Date: 2026-06-25

Status note:

- This document now includes both pushed commits and local unpushed working-tree changes verified on 2026-06-25.
- Local unpushed scope was checked in `yummy_backend` and `yummy-desktop-nextjs`.

Repos covered:

- `yummy_backend`
- `yummy-desktop-nextjs`
- `yummy-admin-dashboard`
- `yummy` Flutter app impact review only

Related commits:

- Backend: `c2248011074967d456105372d9640a6bb757c662` - `Refactor restaurant payment config sync`
- Backend: `eb0789fc54961c21117330a59a3fdbde85f85b7e` - `Add finance module feature flags`
- Web: `a3665e2d2dfcb9d7b25f19b7f1acba198589dcd7` - `Label fallback payment bank in finance UI`
- Web: `4d1fcb45ea681fd4a6f0a482e84492bcdcc3af59` - `Gate finance reports and accounting UI`
- Web: `bc4bbcd8ca5db8d1a3e79268abe3d5d44832ce4d` - `Show finance reports in sidebar`
- Admin: `1cd1140924fac29d3c09956915c6f97bb9074f1c` - `Add admin finance module toggles`

## Purpose

This document records the current parity and rollout behavior for two linked changes:

1. Payment configuration sync between restaurant settings and accounting payment instruments.
2. Restaurant-level feature flags for `Finance Reports` and `Finance Accounting`.
3. Drawer controls staying operational for non-accounting restaurants.

It is meant to answer four questions cleanly:

- What changed in backend, web, and admin.
- What contract the frontend and admin must follow.
- What QA should verify before or after rollout.
- Whether Flutter needs code changes or is safe as-is.
- What mobile should intentionally not implement yet.

## Change Summary

### 1. Payment instrument sync and default bank fallback

The system now treats `Manage > Settings > Payments & POS` as the restaurant-owned source for card and QR configuration, while accounting payment instruments remain the enforcement layer used by checkout and accounting.

Implemented behavior:

- Restaurant settings cards and QRs are synced into accounting payment instruments through a dedicated backend service.
- Each settings-managed card and QR now carries a stable hidden `config_id` so later bank edits or display-name changes still map back to the same accounting instrument.
- Existing restaurants without this key are auto-backfilled the next time their restaurant profile is loaded or updated.
- Legacy or unmatched instruments are attached to a fallback bank named `Default Bank`.
- The web accounting UI labels this fallback as `Default Bank (Needs Review)`.
- Settings-managed instruments that disappear from restaurant settings are deactivated in accounting instead of left drifting indefinitely.
- If a settings-managed card or QR was first posted under `Default Bank` and later gets a real bank assignment, the generated clearing account name is now updated to the real bank so the trial balance no longer stays stuck on `Default Bank`.

Important intentional behavior:

- Fonepay was not auto-converted into a settings-managed payment instrument.
- Fonepay continues to post through its existing integrated payment flow.
- This avoids accidentally making Fonepay stricter before the client payload contract is finalized.

### 2. Restaurant-level finance feature flags

Two new restaurant flags now exist:

- `finance_reports_enabled`
- `finance_accounting_enabled`

These control visibility and access for the web finance submodules:

- `finance_reports_enabled` controls the top-level web Finance Reports area.
- `finance_accounting_enabled` controls the web Accounting workspace.

Design intent:

- The main `Finance` sidebar group remains visible.
- Day-to-day finance flows like Income, Expenses, Day Close, Transactions, and Cash Drawers are not removed by these flags.
- Only the web Reports and Accounting module surfaces are gated.

### 3. Drawer controls are separate from accounting-module gating

Drawer controls are an operational cash-control feature, not an accounting-workspace entitlement.

That means:

- A restaurant can have `finance_accounting_enabled = false` and still use cash drawers.
- Drawer readiness, drawer opening, closing counts, and settlement evidence should continue to work if drawer controls are enabled.
- Enabling drawer controls should not require access to `Finance > Accounting`.

### 4. Local unpushed analytics menu drilldown parity

Local working-tree changes add a much deeper analytics menu workflow in web plus new backend drilldown endpoints.

Implemented locally:

- A dedicated analytics menu page now supports two modes:
  - flat menu totals
  - station-wise breakdown
- The station-wise view groups data by:
  - station
  - category
  - item
  - modifiers and add-ons
- Clicking an item opens order trace details for the exact sold rows in the current date, station, and category scope.
- The page now uses the same finance-style date range dropdown pattern used elsewhere in the app.
- Both flat view and station breakdown support export in:
  - `xlsx`
  - `pdf`
- Menu sorting now supports `category` in addition to revenue, quantity, name, and average price.

Important permission note:

- Backend requires analytics access plus drilldown access for the deeper menu datasets.
- Frontend currently treats `reports.analytics.drilldown` as sufficient to show analytics UI, but the backend drilldown routes still rely on the analytics router guard plus drilldown route guard.
- In practice the correct assignment for a real user is still:
  - `reports.analytics.view`
  - `reports.analytics.drilldown`

### 5. Local unpushed payment identity hardening

Additional local backend and web changes strengthen settings-to-accounting matching beyond the already documented fallback-bank work.

Implemented locally:

- Web checkout payment payloads now include hidden `config_id` inside `instrument.meta` for card and static QR selections.
- Backend accounting lookup now tries `settings_config_id` first and only falls back to instrument name matching if no config-id match exists.
- Restaurant settings forms in web now preserve the hidden `config_id` on edit so a rename does not accidentally create a second instrument.
- Existing restaurant card and QR arrays are auto-normalized with generated `config_id` values when missing.

Why this matters:

- Name-only matching is fragile if operators rename `Nabil POS 1` to `Nabil Bank`.
- Config-id matching keeps accounting identity stable even when display labels change later.

## Backend Contract

### Restaurant model and payload changes

Backend restaurant records now expose:

- `finance_reports_enabled: bool`
- `finance_accounting_enabled: bool`

These fields were added to:

- `app/models/restaurant_model.py`
- `app/schema/restaurant_schema.py`
- `app/services/restaurant_services.py`

They default to `true` for existing and newly migrated restaurants.

That default matters because it prevents surprise breakage on rollout.

### Startup and migration behavior

Backend includes both:

- Alembic migration: `migrations/versions/20260625_add_finance_feature_flags.py`
- Startup guard DDL in `app/main.py`

So even if an environment lags slightly on migrations, the app startup path still attempts to add the columns.

### Feature gate enforcement

Backend now enforces flags server-side, not just in UI.

Server-side gate helper:

- `app/utils/finance_feature_gate.py`

Gated endpoints:

- `/finance-reports/*`
- `/accounting/*`

Current behavior:

- If `finance_reports_enabled = false`, finance report endpoints return `403`.
- If `finance_accounting_enabled = false`, accounting endpoints return `403`.
- Platform staff and superadmin users bypass the gate for operational/admin reasons.

### Payment config sync contract

Settings sync is now centralized in:

- `app/services/restaurant_payment_config_service.py`

Supporting services touched:

- `app/services/payment_instrument_service.py`
- `app/services/bank_service.py`
- `app/services/restaurant_services.py`

Migration support:

- `migrations/versions/e6e682ef9b71_add_payment_banks.py`
- `migrations/versions/20260624_rename_legacy_bank_to_default.py`

Behavior contract:

- If a restaurant card or QR exists in settings and no matching active accounting instrument exists, sync will create or reactivate one.
- If legacy records exist without explicit bank assignment, they are attached to `Default Bank`.
- If an instrument is no longer present in restaurant settings and it was settings-managed, sync deactivates it.

Local unpushed additions:

- Settings-managed card and QR rows can now be matched by hidden `settings_config_id`, not only by mutable display name.
- Accounting finance-event posting now resolves payment instruments by `instrument.meta.config_id` first when present.
- If a real bank later replaces the fallback bank and the generated clearing account still has the old fallback name:
  - the service will rename the empty generated account when safe
  - or detach and rebind the instrument when journal history already exists

### Analytics menu drilldown contract

Local backend working-tree changes add two new analytics drilldown endpoints:

- `GET /analytics/menu/station-breakdown`
- `GET /analytics/menu/station-breakdown/orders`

Behavior contract:

- Both routes are scoped by:
  - `restaurant_id`
  - `date_from`
  - `date_to`
  - optional `timezone`
  - optional `station`
  - optional `category`
  - optional `search`
  - optional `business_line`
- The order-trace route additionally requires:
  - `menu_item_id`
  - paging parameters
- Station breakdown data is grouped by station, category, item, and modifiers.
- Order trace returns sold rows with modifier detail and timestamps.

Permission contract:

- Analytics router itself is protected by `reports.analytics.view`.
- The new drilldown routes also require `reports.analytics.drilldown`.
- Assign both permissions for real users who should use the new drilldown page.

## API Endpoints To Know

### Restaurant profile and flags

- `GET /restaurants/by-user`
  - Used by web and Flutter to fetch the active restaurant profile.
  - Now returns `finance_reports_enabled` and `finance_accounting_enabled`.

- `GET /restaurants/{restaurant_id}`
  - Used by admin dashboard restaurant detail page.

- `PUT /restaurants/{restaurant_id}`
  - Used by admin dashboard and web settings flows.
  - Can now update:
    - `finance_reports_enabled`
    - `finance_accounting_enabled`
    - plus existing restaurant fields

### Platform dashboard

- `GET /admin/platform/dashboard`
  - Recent restaurant payload now includes:
    - `finance_reports_enabled`
    - `finance_accounting_enabled`

### Finance reports

Gated by `finance_reports_enabled`:

- `GET /finance-reports/sales-book`
- `GET /finance-reports/invoices`
- `GET /finance-reports/payments`
- `GET /finance-reports/refunds`
- `GET /finance-reports/vat-sales`

### Accounting

Gated by `finance_accounting_enabled`:

- All `/accounting/*` routes
- This includes setup, reports, daybook, settlements, payment instruments, payment banks, vouchers, and related accounting views

### Drawer controls

Not gated by `finance_accounting_enabled`.

Relevant endpoints:

- `GET /drawer-sessions/controls?restaurant_id={id}`
  - Returns whether drawer controls are enabled for the restaurant.

- `POST /drawer-sessions/controls?restaurant_id={id}&enabled=true|false`
  - Enables or disables drawer controls for the restaurant.

- `GET /drawer-sessions/suggestion?...`
  - Returns opening float suggestion when drawer controls are enabled.
  - Returns `409` if drawer controls are disabled.

- `POST /drawer-sessions/open`
  - Opens a drawer session when drawer controls are enabled and configuration is valid.

Behavior contract:

- Drawer controls are stored in `AccountingSettings.drawer_controls_enabled`.
- This is a shared finance-control setting, but it is not the same as the accounting feature flag.
- Non-accounting restaurants should still be able to manage drawers through operational settings.

### Analytics menu drilldown

Local backend routes:

- `GET /analytics/menu/details`
  - now also supports `sort_by=category`
- `GET /analytics/menu/station-breakdown`
- `GET /analytics/menu/station-breakdown/orders`

These routes are intentionally analytics-focused, not accounting-module routes.
They are not controlled by `finance_reports_enabled` or `finance_accounting_enabled`.
They are controlled by analytics permissions.

## Web Implementation Details

### Files changed

Payment-bank UX:

- `app/(dashboard)/manage/settings/page.tsx`
- `components/finance/accounting/accounting-setup-client.tsx`
- `lib/payment-banks.ts`

Finance feature gating:

- `hooks/use-restaurant.ts`
- `lib/finance-feature-access.ts`
- `components/finance/finance-section-tabs.tsx`
- `components/finance/finance-feature-layout-guard.tsx`
- `app/(dashboard)/finance/reports/layout.tsx`
- `app/(dashboard)/finance/accounting/layout.tsx`
- `hooks/use-sidebar-items.ts`
- `components/layout/global-search.tsx`

Drawer controls UX:

- `app/(dashboard)/manage/settings/page.tsx`
- `components/day-close/drawer-session-panel.tsx`
- `lib/api/endpoints.ts`

Local unpushed analytics menu parity:

- `app/(dashboard)/analytics/menu/page.tsx`
- `app/(dashboard)/analytics/page.tsx`
- `lib/api/endpoints.ts`

Local unpushed payment identity hardening:

- `app/(dashboard)/manage/settings/page.tsx`
- `hooks/use-restaurant.ts`
- `lib/payment-instruments.ts`

### Web visibility rules

When `finance_reports_enabled = true`:

- `/finance/reports` is usable.
- `Reports` tab appears in finance tabs.
- `Reports` item appears inside the Finance sidebar group.

When `finance_reports_enabled = false`:

- `/finance/reports/*` is blocked with a disabled state.
- `Reports` tab is hidden.
- `Reports` child item is hidden from the Finance sidebar.

When `finance_accounting_enabled = true`:

- `/finance/accounting/*` is usable.
- `Accounting` tab appears in finance tabs.
- `Accounting` child item appears in the Finance sidebar.

When `finance_accounting_enabled = false`:

- `/finance/accounting/*` shows the disabled state.
- `Accounting` tab is hidden.
- `Accounting` child item is hidden from the Finance sidebar.

Important clarification:

- The accounting workspace still has its own internal reports section such as Trial Balance, General Ledger, P&L, and Balance Sheet.
- That internal accounting reports section is not the same thing as the top-level Finance Reports tab.
- So `Accounting ON + Reports OFF` is a valid and expected state.

### Analytics menu drilldown rules

Local web behavior:

- `/analytics/menu` is the dedicated analytics menu drilldown page.
- It supports:
  - flat totals view
  - station breakdown view
  - finance-style date range selection
  - station filter
  - category filter
  - text search
  - export to `xlsx`
  - export to `pdf`
- The station breakdown view lets the operator open exact order-trace rows for a selected menu item.

Permission behavior:

- The frontend route currently opens if analytics access check passes.
- That check currently treats either `reports.analytics.view` or `reports.analytics.drilldown` as enough for route visibility.
- The backend drilldown endpoints are stricter.
- Recommended real assignment remains both permissions to avoid visible page plus failing data calls.

### Drawer-controls visibility rules

- Cash Drawers remains part of day-to-day finance operations even if accounting is off.
- When drawer controls are disabled, drawer workspace shows an instructional disabled state instead of pretending opening cash failed for another reason.
- The disabled-state CTA should link to `Manage > Settings > Cash Drawers`, not to accounting setup.
- Restaurant settings now contains the operational `Drawer Controls` toggle so users without accounting workspace access are not blocked.

## Admin Dashboard Implementation Details

Files changed:

- `app/dashboard/restaurants/[id]/page.tsx`
- `lib/backend-api.ts`

Admin detail page now includes toggles for:

- `Restaurant`
- `Hotel`
- `Finance Reports`
- `Finance Accounting`
- `KOT`
- `Tax`

Expected admin behavior:

- Toggle values are loaded from `GET /restaurants/{id}`.
- Save writes back through `PUT /restaurants/{id}`.
- If a restaurant has mobile users only, these flags still only affect the web accounting/reporting surfaces unless mobile later adopts them.

## Payment Configuration Procedure

### Card or QR going forward

Recommended operator procedure:

1. Add the card or QR under `Manage > Settings > Payments & POS`.
2. Assign the intended bank there if known.
3. Save restaurant settings.
4. Backend sync creates or reactivates the accounting payment instrument.
5. In Accounting Setup, verify it appears under payment instruments.
6. If the instrument is on `Default Bank (Needs Review)`, update the bank assignment later.

Important implementation note:

- Operators can rename a card or QR label later without losing accounting identity, because sync no longer relies only on mutable display name.

### Why the fallback exists

The fallback exists so old cards and QRs do not fail silently while a user is still cleaning up accounting structure.

Expected fallback label in UI:

- `Default Bank (Needs Review)`

This communicates two things at once:

- the transaction path is still usable
- the accounting assignment still needs explicit cleanup

### Fonepay procedure

Fonepay remains separate.

Current Fonepay behavior:

- It is enabled by restaurant Fonepay config, not by settings-managed card or QR instrument sync.
- It continues to use the integrated payment flow.
- Accounting currently maps Fonepay through its own method-level clearing setup, not a settings-managed terminal row.

Do not force Fonepay through the card/QR instrument sync path unless the client payload contract is intentionally updated.

## Flutter Parity Status

Flutter repo reviewed:

- `/home/ramon/projects/everacy/yummy`

### Current reality

Flutter does not currently implement the new web accounting workspace or the top-level `/finance-reports` area in the same way as Next.js.

That is acceptable for the current product goal.

Mobile does not need the full accounting module right now.

It does consume:

- `GET /restaurants/by-user`
- existing restaurant module flags like:
  - `restaurant_enabled`
  - `hotel_enabled`

Files confirming current restaurant parsing:

- `lib/features/restaurant/data/models/restaurant_model.dart`
- `lib/features/restaurant/domain/entities/restaurant_entity.dart`
- `lib/core/mapper/restaurant_mapper.dart`
- `lib/core/services/restaurant_details_service.dart`

Flutter also already consumes:

- restaurant `payment_qrs`
- restaurant `payment_cards`
- order payment `instrument.name`
- payment-instrument analytics rows in dashboard/day-close style responses

Files confirming that:

- `lib/features/restaurant/data/models/payment_qr_model.dart`
- `lib/features/restaurant/data/models/payment_card_model.dart`
- `lib/features/orders/presentation/screens/order_bill_payment_screen.dart`
- `lib/features/analytics/data/models/analytics_dashboard_response.dart`
- `lib/features/day_close/data/models/day_close_models.dart`

### Crash risk

Pushing this backend change to main should not crash Flutter by itself.

Reason:

- Flutter only reads known restaurant fields.
- Additional JSON keys are ignored.
- Existing fields used by Flutter were not removed or renamed.

This includes:

- `finance_reports_enabled`
- `finance_accounting_enabled`
- hidden `config_id` values inside `payment_qrs` and `payment_cards`

### What can affect Flutter

Flutter would only be behaviorally affected if both are true:

1. a Flutter screen directly calls a now-gated web finance endpoint like `/finance-reports/*` or `/accounting/*`
2. the restaurant has the corresponding feature flag turned off

Current review result:

- No evidence was found that Flutter currently depends on the web accounting workspace endpoints.
- Flutter does have period-close and periodic reporting areas, but those are distinct from the new web accounting/report screens covered here.
- Flutter also does not need the new web drawer-controls settings UX in order to avoid crashes.
- Flutter does not need the new web analytics menu drilldown page unless the mobile team explicitly wants that surface.

### Current mobile parity gaps that matter

These are the important gaps found during code review.

#### 1. Hidden payment `config_id` is not preserved in Flutter settings

Flutter restaurant models for cards and QRs currently serialize only display values:

- card:
  - `name`
  - optional `identifier`
- QR:
  - `name`
  - `payload`

They do not currently preserve:

- `config_id`
- `bank_id`

Why this matters:

- Backend and web now use `config_id` to keep one settings row tied to one accounting instrument even after rename.
- If Flutter continues to edit restaurant payment settings without carrying `config_id`, it falls back to name-based matching.
- That does not crash checkout, but it is weaker parity than web.

#### 2. Flutter payment selection still posts name-first instruments

Flutter checkout currently builds payment instrument payloads from the selected card or QR using:

- `type`
- `name`
- metadata like:
  - `identifier`
  - `payload`
  - local selected index

It does not currently attach:

- `meta.config_id`

Why this matters:

- Backend accounting lookup now supports stable config-id matching when available.
- Without config-id, backend still falls back to name matching, so payments still work.
- But rename safety remains weaker than web until Flutter also sends the hidden ID.

#### 3. Flutter settings UI does not expose bank assignment

Flutter restaurant settings currently let operators manage:

- card name
- card identifier
- QR name
- QR payload

It does not currently expose payment-bank selection.

Result:

- Mobile does not currently support the full parent-bank assignment flow.
- That is fine as long as bank assignment remains a web-admin task.
- It should be documented so operators do not expect mobile payment settings to fully replace web settings for accounting-backed instruments.

### If Flutter parity is wanted later

Add these fields to Flutter restaurant parsing and local storage:

- `financeReportsEnabled`
- `financeAccountingEnabled`

Likely files:

- `lib/features/restaurant/data/models/restaurant_model.dart`
- `lib/features/restaurant/domain/entities/restaurant_entity.dart`
- `lib/core/mapper/restaurant_mapper.dart`
- `lib/core/services/restaurant_details_service.dart`

This is optional unless mobile later decides to expose the same gated finance modules.

### Minimal Flutter follow-up that is worth doing even without accounting UI

If mobile will continue to edit restaurant payment cards or QRs, this is the small parity-safe follow-up worth implementing:

1. Preserve hidden `config_id` on QR and card models.
2. Preserve optional `bank_id` on QR and card models even if the UI does not edit it yet.
3. Round-trip those fields through:
   - restaurant fetch
   - local cache
   - restaurant update payloads
4. Attach `meta.config_id` when posting card and static-QR payments.

Likely Flutter files:

- `lib/features/restaurant/data/models/payment_card_model.dart`
- `lib/features/restaurant/data/models/payment_qr_model.dart`
- `lib/features/restaurant/data/models/restaurant_model.dart`
- `lib/core/services/restaurant_details_service.dart`
- `lib/features/orders/presentation/screens/order_bill_payment_screen.dart`
- `lib/features/orders/presentation/widgets/add_payment_bottom_sheet.dart`

What mobile does not need now:

- full `/finance/accounting` workspace
- finance feature-flag route gating for accounting screens that do not exist
- web accounting setup, settlements, vouchers, trial balance, or daybook administration

## Verification Checklist

### Backend verification

- [ ] Run Alembic migration for finance feature flags.
- [ ] Confirm `restaurant_info` has:
  - `finance_reports_enabled`
  - `finance_accounting_enabled`
- [ ] Confirm `GET /restaurants/by-user` returns both fields.
- [ ] Confirm `PUT /restaurants/{id}` persists both fields.
- [ ] With `finance_reports_enabled = false`, verify `/finance-reports/sales-book` returns `403`.
- [ ] With `finance_accounting_enabled = false`, verify `/accounting/health` returns `403`.
- [ ] Confirm settings-managed card/QR sync still creates or deactivates accounting instruments correctly.
- [ ] Confirm settings-managed card/QR sync matches by hidden `settings_config_id` when present.
- [ ] Confirm a renamed card or QR still maps back to the original accounting instrument instead of creating a duplicate.
- [ ] Confirm `GET /drawer-sessions/controls?restaurant_id=...` returns current drawer-controls state.
- [ ] Confirm `POST /drawer-sessions/controls?...&enabled=true` enables drawer controls without requiring accounting module access.
- [ ] Verify `GET /analytics/menu/station-breakdown` returns grouped station/category/item/modifier data.
- [ ] Verify `GET /analytics/menu/station-breakdown/orders` returns exact sold-order trace rows for a selected menu item.

### Admin dashboard verification

- [ ] Open restaurant detail page in Yummy Admin.
- [ ] Toggle `Finance Reports` and save.
- [ ] Toggle `Finance Accounting` and save.
- [ ] Reload page and confirm values persist.

### Web verification

- [ ] `reports = ON`, `accounting = OFF`
  - `Reports` child appears in Finance sidebar
  - `/finance/reports` opens
  - `/finance/accounting` shows disabled state
- [ ] `reports = OFF`, `accounting = ON`
  - `Accounting` child appears in Finance sidebar
  - `/finance/accounting` opens
  - `/finance/reports` shows disabled state
- [ ] `reports = ON`, `accounting = ON`
  - both entries visible
  - both routes open
- [ ] `reports = OFF`, `accounting = OFF`
  - neither child visible
  - direct URL opens disabled states
- [ ] Existing cards/QRs without explicit bank assignment show fallback label in accounting UI.
- [ ] Take a card or QR payment while the instrument is still on `Default Bank (Needs Review)`, then assign the real bank and resync.
  - The generated clearing account should no longer stay named `Default Bank ... Clearing`.
  - Trial balance should reflect the corrected bank clearing name after the reassignment sync.
- [ ] With accounting off, open `/cash-drawers` and confirm disabled drawer state links to `/manage/settings?tab=payments#cash-drawers`.
- [ ] In `Manage > Settings > Cash Drawers`, confirm `Drawer Controls` toggle can be enabled.
- [ ] After enabling drawer controls, confirm opening suggestion and drawer open flow no longer return `409` for that reason.
- [ ] Open `/analytics/menu` and verify flat view loads with the finance-style date range dropdown.
- [ ] Switch to station breakdown and verify station, category, item, and modifier groups render.
- [ ] Open order trace from a station-breakdown item and verify exact sold rows load.
- [ ] Export flat view to `xlsx` and `pdf`.
- [ ] Export station breakdown to `xlsx` and `pdf`.
- [ ] Verify category sort works in flat view.

### Flutter verification

- [ ] Login still works.
- [ ] Restaurant fetch still works.
- [ ] Normal POS order and payment flows still work.
- [ ] No Flutter screen crashes due to unknown restaurant response fields.
- [ ] Card and QR payment checkout still works even before Flutter adds `config_id`.
- [ ] If Flutter restaurant settings are used to edit cards or QRs, confirm whether hidden `config_id` and `bank_id` are being preserved. If not, treat that as a parity gap, not a crash blocker.

## Suggested Rollout Procedure

1. Deploy backend code with migration.
2. Leave both feature flags defaulted to `true` initially.
3. Deploy web and admin dashboard.
4. Verify restaurant detail toggles in admin.
5. Verify one test restaurant in each state:
   - reports on / accounting off
   - reports off / accounting on
   - both on
6. Only after validation, start turning features off for selected restaurants.
7. Keep Flutter unchanged unless mobile later needs the same gating behavior.

## Known Limits

- Fonepay is intentionally outside the settings-managed payment instrument sync path for now.
- Flutter does not yet model the new finance feature flags.
- Flutter does not yet preserve hidden card/QR `config_id` or `bank_id` in restaurant settings models.
- Flutter card and QR payments still rely on instrument-name matching instead of config-id matching.
- The disabled-state UX on direct route access is intentionally informative rather than redirect-only.
- Drawer controls still live in finance-backed settings data on the backend, even though the intended user flow is operational rather than accounting-specific.
- The new analytics menu drilldown page is currently a web-only surface.

## Recommended Next Improvements

- Add backend tests explicitly covering the new `403` gate behavior.
- Add a small admin badge or summary on restaurant lists showing reports/accounting flag state.
- If mobile later needs parity, add passive parsing first, then UI gating second.
- If mobile continues to edit payment-card or QR settings, implement `config_id` and `bank_id` roundtrip before treating mobile settings as full parity with web.
- Consider aligning frontend analytics access gating so the UI does not open drilldown pages for users who only have partial analytics permission.
