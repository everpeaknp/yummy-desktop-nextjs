# Quick Checkout Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff review and pay an order from a compact panel on its detail page while the accepted items remain visible beside it.

**Architecture:** Move the existing stateful checkout page into a reusable `OrderCheckoutWorkspace` with `page` and `quick` presentations. Keep the checkout route as a thin page-mode wrapper. In the order detail page, keep the order header, table-bill context, and detail content mounted; open the compact checkout panel in a right-side column and lift the existing order-line quantity/NC sheet to the page level.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, existing Vitest/Testing Library setup.

**Spec:** `docs/superpowers/specs/2026-10-18-inline-order-checkout-design.md`

## Global Constraints

- Keep `/orders/[id]/checkout` available and use the same checkout implementation in page mode.
- Quick checkout stays on `/orders/[id]` and must not duplicate the order header, table-bill switcher, accepted items, or bill summary.
- The order detail quantity/NC editor remains the sole editor for item quantity and NC status.
- Preserve current payment, permission, drawer-readiness, discount, loyalty, split-bill, pre-bill, receipt, room-service, and paid-order behavior.
- Do not change backend APIs, payment semantics, printer output, receipt design, or add dependencies.
- Do not push changes.

## Review Focus

- An order with no accepted items or a requested status must not expose payment actions that are currently unavailable.
- Saving a quantity or NC change must refresh the bill before payment and must not leave stale discounts or balance due.
- Room-service delivery and fully paid orders must retain their current special actions in quick mode.
- Split bills, NC items, customer selection, and drawer readiness must retain existing guards.
- Narrow layouts must keep the bill table and payment controls readable without horizontal page overflow.

---

### Task 1: Extract reusable checkout workspace

**Files:**
- Create: `components/orders/order-checkout-workspace.tsx`
- Modify: `app/(dashboard)/orders/[id]/checkout/page.tsx`
- Test: `components/orders/order-checkout-workspace.test.tsx`

**Interfaces:**
- Produce `OrderCheckoutWorkspace({ orderId, presentation, onBackToOrder?, onEditOrderItem? })`, where `presentation` is `"page" | "inline"`, `onBackToOrder` is an optional zero-argument callback, and `onEditOrderItem` is an optional callback receiving the checkout row's numeric order-item ID.
- The standalone route renders page presentation; inline presentation suppresses its duplicate app-bar/header and `TableBillSwitcher`, and uses `onBackToOrder` for its return action.

- [x] **Step 1: Add focused rendering tests** for page mode retaining the checkout heading/table-bill switcher and inline mode showing the return action without those duplicated elements.
- [x] **Step 2: Run the focused test** with `npm run test:run -- components/orders/order-checkout-workspace.test.tsx`; verify it fails because the reusable component does not exist.
- [x] **Step 3: Move the current checkout implementation** into `components/orders/order-checkout-workspace.tsx`, export the workspace with the interface above, and reduce the route page to a `useParams` wrapper that renders page presentation.
- [x] **Step 4: Implement presentation-specific rendering** while leaving checkout state, payment handlers, permissions, and existing item-note behavior shared.
- [ ] **Step 5: Run the focused test and TypeScript check** with `npm run test:run -- components/orders/order-checkout-workspace.test.tsx` and `npx tsc --noEmit`.

### Task 2: Reuse the order-detail quantity/NC editor in inline checkout

**Files:**
- Modify: `app/(dashboard)/orders/[id]/page.tsx`
- Modify: `components/orders/order-checkout-workspace.tsx`
- Test: `app/(dashboard)/orders/order-detail-inline-checkout.test.tsx`

**Interfaces:**
- Lift the current `DetailsTab` selected-item state, save handler, and quantity/NC sheet to `OrderDetailContent`; pass `onEditOrderItem(item: OrderItem)` into `DetailsTab` and pass an ID-based adapter to inline checkout.
- In inline presentation, an accepted bill row calls `onEditOrderItem` with the matching current `OrderItem`; the existing update API and expected-version/idempotency behavior stay in the lifted handler.
- After a successful line update, refresh order context and checkout bill data before enabling payment again.

- [x] **Step 1: Add failing interaction tests** asserting Checkout remains on `/orders/51`, the accepted item list appears once, clicking a bill row opens the quantity/NC editor, and the detail page does not navigate to checkout.
- [x] **Step 2: Run the focused test** with `npm run test:run -- 'app/(dashboard)/orders/order-detail-inline-checkout.test.tsx'`; verify the current link navigation fails the assertions.
- [x] **Step 3: Lift the existing editor state and update flow** to `OrderDetailContent`, preserving its API payload, toast behavior, and optimistic-override cleanup; keep the sheet mounted at the page level so it works in both detail and inline modes.
- [x] **Step 4: Wire the inline bill-row callback** to the lifted editor and refresh both order context and the bill after a successful update.
- [ ] **Step 5: Run the focused test and the existing order/table-bill tests** with `npm run test:run -- 'app/(dashboard)/orders/order-detail-inline-checkout.test.tsx' components/orders/table-bill-switcher.test.tsx`.

### Task 3: Switch order detail between details and inline checkout

**Files:**
- Modify: `app/(dashboard)/orders/[id]/page.tsx`
- Modify: `components/orders/order-checkout-workspace.tsx`
- Test: `app/(dashboard)/orders/order-detail-inline-checkout.test.tsx`

**Interfaces:**
- Add page-local `checkoutOpen` state. The existing eligible Checkout action sets it true; inline workspace Back to order sets it false.
- Keep the order title/status area and `TableBillSwitcher` mounted once. Render inline workspace in the content area in checkout mode, and render existing tabs/details when checkout mode is closed.

- [x] **Step 1: Extend interaction tests** for Back to order, room-service label/action preservation, and paid-order action preservation.
- [x] **Step 2: Run the focused test** and confirm the new return/special-action assertions fail before implementation.
- [x] **Step 3: Replace the Checkout `Link` with a button** that opens inline mode while preserving the current permission checks and room-service/paid labels; render one workspace and hide the details tabs while inline mode is active.
- [x] **Step 4: Verify standalone route and representative interactions** with the focused tests, table-bill-switcher tests, and `npx tsc --noEmit`.
- [ ] **Step 5: Visually check desktop and narrow viewports** for duplicated order context, item list duplication, overflow, and the compact checkout hierarchy in the spec.

### Task 4: Regression verification

**Files:**
- Test: existing checkout, order, receipt, payment, and table-bill component tests as applicable.

- [x] **Step 1: Run focused checkout and order tests** including the new inline flow tests and existing route-adjacent suites.
- [x] **Step 2: Run `npx tsc --noEmit`** and resolve any errors introduced by the extraction or props.
- [x] **Step 3: Run the relevant production build** with `npm run build` if the local environment has the required fonts/network configuration; record unrelated environment failures precisely.
- [x] **Step 4: Review the final diff** for API, payment, receipt, printer, permissions, and routing behavior outside the spec's scope; leave all changes local and unpushed.
