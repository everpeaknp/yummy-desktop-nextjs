# Desktop Web Implementation (From Backend Backlog 2026-04-07)

Source backlog: `../yummy_backend/reports/WEB_IMPLEMENTATION_BACKLOG_2026-04-07.md` (dated **2026-04-07**).

This assessment is for this repo: `yummy-desktop-nextjs` (updated **2026-04-16**).

## Decision: Does desktop-nextjs need updates?

**Yes (but mostly P1 now).** The backlog P0 parity items are now largely implemented in the web UI; remaining work is primarily operational P1 modules and a few follow-up polish/consistency tasks.

## Current State (What’s Already In Place)

### Already present in `lib/api/endpoints.ts`

- Payroll: list/get/create/approve/paid/cancel/add-adjustments + **PDF** + **adjustment delete** exist (`PayrollApis.*`).
- Day close: validate/snapshot/initiate/confirm + cancel/reopen/audit-log/snapshot + cash reconciliation adjustment + adjustments endpoints + exports (PDF/Excel) exist (`DayCloseApis.*`).
- Inventory: **ledger** + adjustment **payment/reject** endpoints exist (`InventoryApis.getLedger`, `InventoryApis.markAdjustmentPayment`, `InventoryApis.rejectAdjustmentPayment`), but **modifier-link** endpoints are missing.
- KOT: item-level endpoints exist (`KotApis.updateKotItemFulfillment`, etc.) but appear **unused** by the current kitchen UI.

### Existing routes/pages

- Payroll lifecycle exists end-to-end:
  - List: `app/(dashboard)/payroll/page.tsx`
  - Create: `app/(dashboard)/payroll/create/page.tsx`
  - Detail/actions: `app/(dashboard)/payroll/[id]/page.tsx`
- Analytics dashboard exists: `app/(dashboard)/analytics/page.tsx` (uses only dashboard endpoints; includes day-close modal).
- Analytics drilldowns exist:
  - `app/(dashboard)/analytics/compare/page.tsx`
  - `app/(dashboard)/analytics/menu/page.tsx`
  - `app/(dashboard)/analytics/staff/page.tsx`
  - `app/(dashboard)/analytics/kitchen/page.tsx`
  - `app/(dashboard)/analytics/inventory/page.tsx`
- Period close now includes rebuild + snapshot + PDF download fallbacks:
  - `app/(dashboard)/period-reports/page.tsx`
- Day close advanced ops now exist with dedicated page + actions:
  - `app/(dashboard)/day-close/page.tsx`
  - `components/analytics/day-close-history.tsx`
- Settings fragmentation exists exactly as backlog states:
  - Placeholder: `app/(dashboard)/settings/page.tsx`
  - Real settings: `app/(dashboard)/manage/settings/page.tsx`

## What’s Still Missing (Backlog Remaining)

### P0
- No remaining P0 parity blockers from the 2026-04-07 backlog found in this repo. (Most remaining issues are polish/bugs rather than missing routes.)

### P1 gaps (ops modules)

- Inventory advanced ops UI:
  - Ledger screen for inventory item movements is not surfaced.
  - Adjustment payment state transitions UI is not surfaced.
  - Modifier <-> inventory linkage endpoints + UI are missing.
- Kitchen item-level controls:
  - Item accept/reject/progress actions exist as endpoints but are not wired in UI.
  - KOT activity timeline UI is missing.
- Scoped notifications:
  - Implemented via Next.js proxy routes under `/api/notifications/*` to avoid localhost CORS, and wired into the order detail "Order Activity" panel.
  - Note: whether any events appear depends on backend actually emitting/storing notifications for that entity.
- Transactions module:
  - `/transactions` list is implemented with filters + modal details.
  - `/transactions/[id]` exists as a deep-link route (redirects to `/transactions?tx=<id>` to open the modal).

### P2 gaps (platform/admin)

- Access scope management: missing endpoints + admin UI.
- Admin/platform endpoints: `/admin/dashboard/lite`, `/api/v1/app/version`, `/device-tokens*`, `/roles/built-in`, `/history/menu/{id}`, `/history/config/{type}/{id}`, `/menus/upload/signature`, `/restaurants/upload/signature`, `/qr/verify/{token}`, `/sales` (decide what is actually needed for desktop web).
- `/users/me/profile` is used directly in code but not declared in `lib/api/endpoints.ts`:
  - Direct usage: `hooks/use-auth.ts`

## Suggested Next Steps (Order)

1. Kitchen item-level controls + activity timeline
2. Inventory advanced ops (ledger + adjustment payment/reject + modifier-inventory linking)
3. Platform/admin cleanup (only if needed)

## Implementation Plan (Recommended)

### Phase 0: Prep (0.5 day)

- Align with backend contract for each item:
  - Confirm payloads for payroll detail/actions, day-close adjustments, analytics drilldowns, period snapshots/rebuild.
- Add missing endpoint helpers first (low risk, unlocks UI work):
  - `PayrollApis.runPdf(runId)`
  - `PayrollApis.deleteAdjustment(adjustmentId)`
  - `AnalyticsApis.compare(...)` + `AnalyticsApis.menuDetails(...)` etc.
  - `PeriodCloseApis.weeklyRebuild(...)`, `PeriodCloseApis.weeklySnapshot(id)` (and monthly variants)
  - `DayCloseApis.adjustCashReconciliation(id)`, `DayCloseApis.listAdjustments(id)`, `DayCloseApis.addExpenseAdjustment(id)`, `DayCloseApis.addIncomeAdjustment(id)`, `DayCloseApis.exportPdf(id)`, `DayCloseApis.exportExcel(id)`
  - `AuthApis.meProfile` (wrap `/users/me/profile`)

Acceptance: all new helpers are used by at least one screen or are covered by a simple smoke call path.

### Phase 1: P0 Parity (ship first)

1. Payroll lifecycle
   - Add routes:
     - `app/(dashboard)/payroll/create/page.tsx`
     - `app/(dashboard)/payroll/[id]/page.tsx`
   - Add shared UI component(s):
     - `components/payroll/payroll-run-actions.tsx` (approve, paid, cancel, pdf, adjustments)
     - `components/payroll/adjustment-editor.tsx` (add/remove)
   - Wire:
     - “New Payroll Run” button on `app/(dashboard)/payroll/page.tsx` -> `/payroll/create`
     - List deep-links -> detail page actually exists

   Acceptance:
   - Create run, open detail, approve, mark paid (method/ref/date), cancel (reason), add/remove adjustments.
   - PDF download/preview works and uses correct MIME + filename.

2. Analytics drilldowns
   - Add routes:
     - `app/(dashboard)/analytics/compare/page.tsx` (optional but recommended)
     - `app/(dashboard)/analytics/menu/page.tsx`
     - `app/(dashboard)/analytics/staff/page.tsx`
     - `app/(dashboard)/analytics/kitchen/page.tsx`
     - `app/(dashboard)/analytics/inventory/page.tsx`
   - UI:
     - Reusable table component with paging/sort/search and “date range + station + business line” filters.
   - Wire navigation from `app/(dashboard)/analytics/page.tsx`.

   Acceptance:
   - Each drilldown loads from backend details endpoint and supports filter + pagination.

3. Period close rebuild + snapshots
   - Update `app/(dashboard)/period-reports/page.tsx`:
     - Add “Snapshot” action (dialog) per weekly/monthly row
     - Add “Rebuild” action with confirmation and refresh
   - Add component:
     - `components/period-close/period-snapshot-dialog.tsx`

   Acceptance:
   - Snapshot can be viewed for existing period closes; rebuild runs and list refreshes.

4. Day close advanced ops
   - Add a dedicated page under analytics for admin workflows:
     - `app/(dashboard)/analytics/day-close/page.tsx`
   - Add components:
     - `components/analytics/day-close-history.tsx` (list + select)
     - `components/analytics/day-close-adjustments.tsx` (income/expense add + list)
     - `components/analytics/day-close-exports.tsx` (PDF/Excel)
     - `components/analytics/day-close-audit.tsx` (audit timeline)
   - Keep `components/analytics/day-close-modal.tsx` as the “quick close” entry point.

   Acceptance:
   - Closed day can be reopened/corrected with auditable reason.
   - Adjustments ledger is visible and editable with permissions.
   - Export PDF/Excel downloads correctly.

### Phase 2: P1 Ops Coverage

- Inventory advanced ops:
  - Add modifier-inventory linking endpoints + UI in `app/(dashboard)/inventory/page.tsx`.
  - Surface ledger view (dialog) for an inventory item using existing `InventoryApis.getLedger`.
- Kitchen item-level ops:
  - Add item-level actions + activity drawer to `app/(dashboard)/kitchen/page.tsx`.
- Scoped notifications:
  - Add endpoints + contextual panels (orders/kitchen/inventory) for entity-specific notification timelines.
- Transactions:
  - Add routes `app/(dashboard)/transactions/page.tsx` and `app/(dashboard)/transactions/[id]/page.tsx`.

### Phase 3: P2 Admin/Platform Cleanup

- Staff access scopes editor:
  - Add endpoints + UI in `app/(dashboard)/staff/[id]/page.tsx` (or a staff detail route if missing).
- Decide what to surface now:
  - `/admin/dashboard/lite`, `/api/v1/app/version`, `/device-tokens*`, `/roles/built-in`, `/sales`, `/qr/verify/{token}`
  - history/signature endpoints (only if required by actual web flows)
- Settings consolidation:
  - Either redirect `/settings` -> `/manage/settings` or promote `/settings` into a real hub.

## Notes / Backlog Drift Since 2026-04-07

This repo already includes several endpoint helpers the backlog listed as missing (notably inventory ledger/payment and multiple day-close helpers). The remaining work is primarily **UI routing + wiring**, plus a handful of still-missing helpers (analytics compare/details, payroll PDF/delete adjustment, period close rebuild/snapshot, day-close adjustments/exports, notifications scoped, transactions, access-scopes).
