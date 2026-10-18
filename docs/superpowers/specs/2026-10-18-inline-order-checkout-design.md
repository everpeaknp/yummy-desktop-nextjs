# Quick checkout side panel design

## Goal

Let restaurant staff open a compact checkout panel on the right side of an order’s detail page while keeping the order details and accepted items visible.

## User need

Today the order detail page shows accepted items and an order summary, but its Checkout action navigates to a separate `/orders/[id]/checkout` page. Staff must change context to review the bill and take payment. The order page already lets staff open an item and adjust quantity; checkout owns payment, discount, loyalty, split-bill, and pre-bill behavior.

## Recommended design

Clicking **Checkout** opens a quick-checkout panel beside the existing order details. Keep the order header, table-bill switcher, tabs, accepted items, and order context visible on the left. The panel contains only the bill summary, loyalty/customer selection, payment action, and related Discount, Split Bill, Edit Order, and Pre-Bill actions. Do not repeat the item list or the order-page bill summary inside the panel. On narrow screens, stack the panel after the order details.

The accepted item list remains the place to open the existing quantity and NC editor. Saving uses the existing order-line update API, then refreshes order details and the checkout bill so quantities, NC amounts, discounts, and balance due agree before payment. Payment remains disabled until refresh succeeds, with a retry action after failure.

Extract the stateful checkout workspace from the route page into a reusable order-checkout component with page and quick presentation modes. Keep payment calculations, permissions, drawer readiness, payment instruments, discounts, loyalty redemption, split bills, pre-bill, and receipt behavior in this shared workspace. The `/orders/[id]/checkout` route remains available and renders the same workspace in page mode for existing links and workflows.

The panel has a clear close action and does not change the URL. Completed payments refresh order state; receipt viewing/printing can continue to open the existing receipt route.

## Behavior and safeguards

- The quick-checkout panel opens on the existing `/orders/[id]` path and does not push the user to `/checkout`.
- Order details and accepted items remain visible while the panel is open.
- The checkout button retains its current permissions and special labels for paid orders and room-service orders.
- Room-service delivery keeps its current completion rules and does not expose restaurant payment controls incorrectly.
- Fully paid, split-bill, credit, NC-customer, and drawer-readiness rules remain unchanged.
- The accepted-item quantity sheet remains the sole order-line quantity editor. Checkout totals refresh after an item update and before a payment is submitted.
- Closing the panel leaves the user on order details without losing server-saved changes.
- Existing direct links to `/orders/[id]/checkout`, guest-bill payment links, receipt return paths, and table-bill navigation keep working.
- No API shape, backend behavior, printer output, or receipt design changes are included.

## Scope

Frontend only. Reuse existing order and checkout APIs and permission checks. Expected implementation areas are the order detail route, the checkout route, and a shared checkout workspace component; update focused tests for panel rendering, item refresh, and existing checkout-route behavior.

## Acceptance criteria

1. Clicking Checkout from an eligible order keeps the browser on `/orders/[id]` and opens a right-side quick-checkout panel.
2. Order details and accepted items remain visible once; the panel does not repeat them or duplicate the detail-page bill summary.
3. Clicking an accepted item opens the current quantity/NC editor; saving updates the displayed quantity and recalculates bill totals before payment.
4. The panel summary, customer selection, Take Payment, Discount, Split Bill, and Pre-Bill actions retain their existing permission and readiness rules.
5. Returning to order details and opening a receipt work without losing saved order or payment state.
6. The standalone checkout route and links to it continue to work using the same checkout implementation.
7. Room-service, fully-paid, split-bill, NC-item, and mobile layouts remain correct.
8. Focused tests and TypeScript checks pass; the changed flow is visually checked at desktop and mobile sizes.

## Out of scope

- Redesigning payment dialogs, discount rules, split-bill behavior, or receipt/printer output.
- Changing backend endpoints, permissions, or payment semantics.
- Removing the standalone checkout route.
