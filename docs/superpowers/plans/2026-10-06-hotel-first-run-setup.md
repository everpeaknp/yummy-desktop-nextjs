# Hotel First-Run Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-blocking, permission-aware Hotel setup checklist to the existing Hotel workspace so newly enabled properties can configure rooms, rates, settings, and team access without losing normal navigation.

**Architecture:** Derive readiness from existing Hotel and staff APIs through a focused hook and pure readiness model. Render a checklist above the current Hotel content and route its actions into the existing panels, adding only the missing room-type base-rate edit needed to make zero-rate warnings actionable.

**Tech Stack:** Next.js 14, React, TypeScript, Axios API client, Vitest, existing Hotel panels and permission helpers.

**Spec:** [2026-10-06 Hotel First-Run Setup Design](../specs/2026-10-06-hotel-first-run-setup-design.md)

## Global Constraints

- Keep the shared dashboard header, sidebar, and existing Hotel tabs available.
- Do not add a backend migration, onboarding record, second membership model, or plan/entitlement mutation.
- Use existing `/hotel/v2` and `/users/all` contracts and effective permission keys; do not infer roles from labels.
- A building/floor, rate plan, or date override is optional; never use `listBuildings()` as a required readiness signal because it creates a default building.
- Required operational readiness is one active room type, one active room linked to an active type, and a positive base rate.
- Treat core Hotel API failures as retryable unknown state, not as missing setup; team access is informational and non-blocking.
- Preserve per-action authorization and send unauthorized setup actions to a polite administrator handoff.

## Review Focus

- **Room points to an inactive or missing type:** it must not satisfy active-room readiness. Test this in the readiness-model task.
- **Zero or malformed base rate:** it must produce an attention state and never appear sell-ready. Test zero, positive, and invalid values in the readiness-model task.
- **Optional building/floor or rate-plan data is absent:** readiness must still pass when the three required conditions pass. Test this in the readiness-model task and verify the hook never calls `listBuildings()`.
- **Staff list is forbidden or fails temporarily:** it must not block setup or invent an empty team. Test both cases in the readiness-hook task.
- **Core Hotel data request fails:** show retryable state while leaving all Hotel tabs usable; do not show false incomplete statuses. Test this in the hook and checklist tasks.

---

### Task 1: Model Hotel setup readiness and load existing data

**Files:**
- Create: `lib/hotel/setup-readiness.ts`
- Create: `lib/hotel/setup-readiness.test.ts`
- Create: `hooks/use-hotel-setup-readiness.ts`
- Create: `hooks/use-hotel-setup-readiness.test.ts`
- Modify: `lib/hotel/api.ts` only if a typed existing-list call is missing

**Interfaces:**
- Produce `buildHotelSetupReadiness(input: HotelSetupInput): HotelSetupReadiness`, where input is `{ settings: HotelPropertySettings | null; roomTypes: HotelRoomType[]; rooms: HotelRoom[]; floors: HotelFloor[]; ratePlans: HotelRatePlan[] }`. Output step state must distinguish `ready`, `needs_attention`, `optional`, and `unknown`; the operational-ready result requires the active room to link to an active room type whose `base_rate` is positive.
- Produce `useHotelSetupReadiness(restaurantId: number, canViewStaff: boolean)`, returning `{ status, readiness, hotelTeam, teamStatus, reload }`.
- Filter team entries by effective permission keys beginning with `hotel.`; call `/users/all` only when `canViewStaff` is true.

- [ ] **Step 1: Write readiness model tests** for no types, no active room, room linked to inactive type, zero/positive/invalid base rates, valid settings defaults, and no floors/rate plans while all required checks pass, including that the active room links to the positively priced active type.
- [ ] **Step 2: Run `npm run test:run -- lib/hotel/setup-readiness.test.ts`** and confirm the new tests fail because the model is absent.
- [ ] **Step 3: Implement the typed input/output and pure readiness function** in `lib/hotel/setup-readiness.ts`; do not encode buildings as a readiness input.
- [ ] **Step 4: Run the readiness tests** and confirm they pass.
- [ ] **Step 5: Write hook tests** for successful data loading, no `listBuildings()` call, staff filtering, staff 403 handoff, staff network failure as a separate retryable state, and core Hotel API failure.
- [ ] **Step 6: Run `npm run test:run -- hooks/use-hotel-setup-readiness.test.ts`** and confirm the tests fail before implementation.
- [ ] **Step 7: Implement `useHotelSetupReadiness`** using settings, room types, rooms, floors, and rate plans APIs; load the staff list only with staff-view permission. Core Hotel requests determine `status`; staff request failures do not invalidate Hotel readiness.
- [ ] **Step 8: Run both focused test files and `npx tsc --noEmit`**; confirm tests and TypeScript pass.
- [ ] **Step 9: Commit only these files** with `feat: derive hotel setup readiness`.

### Task 2: Make room-type rate warnings actionable

**Files:**
- Modify: `lib/hotel/api.ts`
- Modify: `components/hotel/inventory-panel.tsx`
- Test: `lib/hotel/api.test.ts` (or the existing Hotel API test file)
- Test: `components/hotel/inventory-panel.test.tsx`

**Interfaces:**
- Produce `hotelPmsApi.updateRoomType(roomTypeId: number, input: Partial<Pick<HotelRoomType, "name" | "code" | "base_rate" | "max_adults" | "max_children" | "amenities" | "is_active">>): Promise<HotelRoomType>` using `PATCH /hotel/v2/room-types/{id}`.
- Add `initialMode?: "book" | "manage"` to `InventoryPanel`; default remains the current `book` behavior.

- [ ] **Step 1: Write API test** asserting the helper PATCHes the room-type endpoint and unwraps the returned room type; write panel tests for entering manage mode and updating an existing type's base rate.
- [ ] **Step 2: Run the focused API and inventory-panel tests** and confirm the new assertions fail.
- [ ] **Step 3: Implement the API helper and room-type edit flow** by reusing the existing type dialog, pre-filling the chosen type, and preserving the current create flow. Show save/loading/error states and refresh inventory after success.
- [ ] **Step 4: Implement `initialMode`** without changing default behavior for other callers.
- [ ] **Step 5: Run focused tests and `npx tsc --noEmit`**; confirm both pass.
- [ ] **Step 6: Commit only these files** with `feat: edit hotel room type rates`.

### Task 3: Build the setup checklist component

**Files:**
- Create: `components/hotel/hotel-setup-checklist.tsx`
- Create: `components/hotel/hotel-setup-checklist.test.tsx`

**Interfaces:**
- Consume `HotelSetupReadiness` and team/status output from Task 1.
- Accept `onOpenInventory`, `onOpenRates`, `onOpenSettings`, and `onOpenStaff` callbacks plus permission booleans for managing inventory, rates/settings, and staff.

- [ ] **Step 1: Write component tests** for loading skeleton, incomplete and ready states, collapse/reopen, optional steps, zero-rate wording/action, team list filtering, unauthorized handoff, and retryable errors that do not render false missing states.
- [ ] **Step 2: Run `npm run test:run -- components/hotel/hotel-setup-checklist.test.tsx`** and confirm they fail before the component exists.
- [ ] **Step 3: Implement a compact `Get your hotel ready` checklist** with kind operational copy, step status and reason, accessible collapse/reopen controls, and callback-based actions. Once required checks pass, render a compact ready state with a reopen action.
- [ ] **Step 4: Keep team review informational**; show users with `hotel.*` effective grants, and show administrator handoff when staff viewing is forbidden or staff management is unavailable.
- [ ] **Step 5: Run component tests and lint the new component**; confirm they pass.
- [ ] **Step 6: Commit only these files** with `feat: add hotel setup checklist`.

### Task 4: Integrate checklist into Hotel workspace and verify responsive behavior

**Files:**
- Modify: `app/(dashboard)/hotel/page.tsx`
- Modify: `components/hotel/rates-panel.tsx`
- Test: `app/(dashboard)/hotel/page.test.tsx` or the existing Hotel page test location

**Interfaces:**
- Add `initialSection?: "pricing" | "plans" | "settings"` to `RatesPanel`; default remains current behavior.
- Route checklist callbacks to the existing inventory manage mode, rates/settings section, and staff detail/roles routes without replacing the active Hotel page or global shell.

- [ ] **Step 1: Write page integration tests** asserting the checklist renders above the existing Hotel panel, the tabs remain present, inventory action opens manage mode, settings action opens the existing settings section, and staff action routes only for users with appropriate staff access.
- [ ] **Step 2: Run the focused page test** and confirm the new assertions fail.
- [ ] **Step 3: Implement page wiring** using `useHotelSetupReadiness`, existing `can(...)` permission checks, and the callback props. Keep the checklist non-modal and do not block any already-authorized Hotel tab.
- [ ] **Step 4: Implement `RatesPanel.initialSection`** so setup actions can open the existing settings UI directly.
- [ ] **Step 5: Run Hotel readiness, inventory, checklist, and page tests; run `npx tsc --noEmit` and `npx next lint --file 'app/(dashboard)/hotel/page.tsx' --file components/hotel/hotel-setup-checklist.tsx --file components/hotel/inventory-panel.tsx --file components/hotel/rates-panel.tsx --file hooks/use-hotel-setup-readiness.ts --file lib/hotel/setup-readiness.ts`.** Resolve any failures caused by these changes.
- [ ] **Step 6: Use an authenticated browser session on an enabled Hotel property** to verify desktop and mobile widths, incomplete and ready states, collapse/reopen, links to existing tabs, and a temporary API failure. Confirm the shared sidebar/header remain visible and existing Hotel operations remain usable.
- [ ] **Step 7: Commit only the implementation and its focused tests** with `feat: integrate hotel first-run setup`.

## Execution Notes

Use the existing local frontend session and test account only for read-only UI verification; do not change live staff assignments, subscription entitlements, or production-like data. If the backend rejects the current user's `/users/all` request, verify the polite administrator handoff instead of changing permissions to force access. Do not stage or include unrelated files already present in the worktree.

