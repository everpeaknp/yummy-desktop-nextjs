# Desktop Web Implementation (From Backend Backlog 2026-04-07)

Source backlog: `../yummy_backend/reports/WEB_IMPLEMENTATION_BACKLOG_2026-04-07.md` (dated **2026-04-07**).

This assessment is for this repo: `yummy-desktop-nextjs` (checked **2026-04-14**).

## Decision: Does desktop-nextjs need updates?

**Yes.** The app has good baseline coverage, but it is still missing several parity-critical (P0) web routes and UIs that the backlog calls out. Some API helper gaps from the backlog have already been addressed in `lib/api/endpoints.ts`, but key flows are not wired in the UI yet.

## Current State (What’s Already In Place)

### Already present in `lib/api/endpoints.ts`

- Payroll: list/get/create/approve/paid/cancel/add-adjustments exist (`PayrollApis.*`), but **PDF** + **adjustment delete** are missing.
- Day close: validate/snapshot/initiate/confirm + **cancel/audit-log/snapshot/reopen** exist (`DayCloseApis.*`), but **cash reconciliation adjustment**, **adjustments ledger**, **exports (PDF/Excel)** are missing.
- Inventory: **ledger** + adjustment **payment/reject** endpoints exist (`InventoryApis.getLedger`, `InventoryApis.markAdjustmentPayment`, `InventoryApis.rejectAdjustmentPayment`), but **modifier-link** endpoints are missing.
- KOT: item-level endpoints exist (`KotApis.updateKotItemFulfillment`, etc.) but appear **unused** by the current kitchen UI.

### Existing routes/pages

- Payroll list exists: `app/(dashboard)/payroll/page.tsx` (deep-links to `/payroll/{id}` but the detail route is missing).
- Analytics dashboard exists: `app/(dashboard)/analytics/page.tsx` (uses only dashboard endpoints; includes day-close modal).
- Period close list/preview/confirm exists: `app/(dashboard)/period-reports/page.tsx` (missing rebuild/snapshot actions).
- Settings fragmentation exists exactly as backlog states:
  - Placeholder: `app/(dashboard)/settings/page.tsx`
  - Real settings: `app/(dashboard)/manage/settings/page.tsx`

## Confirmed Gaps (What’s Missing Here)

### P0 gaps (parity blockers)

1. **Payroll lifecycle UI**
   - Missing routes: `app/(dashboard)/payroll/[id]/page.tsx`, `app/(dashboard)/payroll/create/page.tsx`
   - Missing endpoints: `GET /payroll/runs/{id}/pdf`, `DELETE /payroll/adjustments/{adjustment_id}`
   - Missing UX: approve/paid/cancel/adjustments/PDF actions on detail screen; “New Payroll Run” button is not wired.

2. **Analytics drilldowns**
   - Missing routes: `app/(dashboard)/analytics/menu/page.tsx`, `.../staff/page.tsx`, `.../kitchen/page.tsx`, `.../inventory/page.tsx` (and optionally a compare page)
   - Missing endpoints: `/analytics/compare` and `/analytics/*/details`

3. **Period close rebuild + snapshots**
   - Missing endpoints: weekly/monthly `rebuild` and `snapshot`
   - Missing UI actions in `app/(dashboard)/period-reports/page.tsx`

4. **Day-close advanced ops (post-close corrections + exports)**
   - Missing endpoints in `DayCloseApis`: adjust cash reconciliation, adjustments CRUD/list, exports (PDF/Excel)
   - Missing UI: history view, adjustments ledger view, audit timeline view, export actions

### P1 gaps (ops modules)

- Inventory advanced ops UI: payment state transitions + stock movement ledger screen is not surfaced (even though ledger/payment endpoints exist); modifier-inventory linking is missing.
- Kitchen item-level controls: item accept/reject/progress + activity timeline not wired into `app/(dashboard)/kitchen/page.tsx`.
- Scoped notifications: missing `GET /notifications/orders/{id}`, `/kots/{id}`, `/inventory/{id}` endpoints + UI panels.
- Transactions module: missing routes (`/transactions`, `/transactions/[id]`) and API helper.

### P2 gaps (platform/admin)

- Access scope management: missing endpoints + admin UI.
- Admin/platform endpoints: `/admin/dashboard/lite`, `/api/v1/app/version`, `/device-tokens*`, `/roles/built-in`, `/history/menu/{id}`, `/history/config/{type}/{id}`, `/menus/upload/signature`, `/restaurants/upload/signature`, `/qr/verify/{token}`, `/sales` (decide what is actually needed for desktop web).
- `/users/me/profile` is used directly in code but not declared in `lib/api/endpoints.ts`:
  - Direct usage: `hooks/use-auth.ts`

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

