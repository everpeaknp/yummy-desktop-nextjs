# Inline order checkout design

## Goal

Let restaurant staff begin checkout from an order’s detail page without leaving that page. Keep the accepted-item context visible, make quantity changes understandable, and expose the existing payment actions in a compact layout.

## User need

Today the order detail page shows accepted items and an order summary, but its Checkout action navigates to a separate `/orders/[id]/checkout` page. Staff must change context to review the bill and take payment. The order page already lets staff open an item and adjust quantity; checkout has a separate bill table and owns payment, discount, loyalty, split-bill, and pre-bill behavior.

## Recommended design

Keep the order detail route as the working page. Clicking **Checkout** switches that page into an inline checkout state instead of navigating to the checkout route. Keep the same order header and table-bill context. Replace the compact accepted-items card with the bill-item table used by checkout, followed by a compact bill summary and the existing customer/payment controls. On narrow screens these sections stack in the same order.

Clicking an item continues to open the existing quantity and NC editor. Saving uses the existing order-line update API, then refreshes both order details and the bill so quantities, NC amounts, discounts, and balance due agree before payment. The bill table must not introduce a second quantity-edit implementation.

Extract the stateful checkout workspace from the route page into a reusable order-checkout component with page and inline presentation modes. Keep payment calculations, permissions, drawer readiness, payment instruments, discounts, loyalty redemption, split bills, pre-bill, and receipt behavior in this shared workspace. The `/orders/[id]/checkout` route remains available and renders the same workspace in page mode for existing links and workflows.

In inline mode, avoid repeating the order header, table-bill switcher, and item list. Show one clear **Back to order** action to collapse checkout. Completed payments should refresh the order page state; receipt viewing/printing can continue to open the existing receipt route.

## Behavior and safeguards

- The inline checkout opens on the existing `/orders/[id]` path and does not push the user to `/checkout`.
- The checkout button retains its current permissions and special labels for paid orders and room-service orders.
- Room-service delivery keeps its current completion rules and does not expose restaurant payment controls incorrectly.
- Fully paid, split-bill, credit, NC-customer, and drawer-readiness rules remain unchanged.
- The accepted-item quantity sheet remains the sole order-line quantity editor. Checkout totals refresh after an item update and before a payment is submitted.
- Closing inline checkout returns to the order detail view without losing server-saved changes.
- Existing direct links to `/orders/[id]/checkout`, guest-bill payment links, receipt return paths, and table-bill navigation keep working.
- No API shape, backend behavior, printer output, or receipt design changes are included.

## Scope

Frontend only. Reuse existing order and checkout APIs and permission checks. Expected implementation areas are the order detail route, the checkout route, and a shared checkout workspace component; update focused tests for navigation, inline rendering, item refresh, and existing checkout-route behavior.

## Acceptance criteria

1. Clicking Checkout from an eligible order keeps the browser on `/orders/[id]` and reveals inline checkout content.
2. The order’s accepted items appear once, using the checkout bill table layout in checkout mode.
3. Clicking an accepted item opens the current quantity/NC editor; saving updates the displayed quantity and recalculates bill totals before payment.
4. The inline payment summary, customer selection, Take Payment, Discount, Split Bill, and Pre-Bill actions retain their existing permission and readiness rules.
5. Returning to order details and opening a receipt work without losing saved order or payment state.
6. The standalone checkout route and links to it continue to work using the same checkout implementation.
7. Room-service, fully-paid, split-bill, NC-item, and mobile layouts remain correct.
8. Focused tests and TypeScript checks pass; the changed flow is visually checked at desktop and mobile sizes.

## Out of scope

- Redesigning payment dialogs, discount rules, split-bill behavior, or receipt/printer output.
- Changing backend endpoints, permissions, or payment semantics.
- Removing the standalone checkout route.
