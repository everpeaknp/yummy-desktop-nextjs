# yummy-desktop-nextjs

Next.js desktop dashboard for a multi-tenant restaurant-management SaaS. Talks
to the FastAPI backend at `c:\yummy_backend`. **Live production system**—a
companion Flutter app uses the same contracts and has completed the Purchase /
Purchase Return / Expense cutover described below.

## Inventory / Purchase / Purchase Return / Expense refactor (2026-08)

The backend split "Inventory" (stock only) from "Purchase" (supplier + inventory increase), "Purchase Return" (supplier + inventory decrease), and "Expense" (non-inventory spend) — see `c:\yummy_backend\CLAUDE.md` for the full architecture. This repo's frontend was cut over to match:

- **`app/(dashboard)/inventory/page.tsx`** — the old single "Adjust Stock" dialog (4-type dropdown: add/waste/return/correction, with cost/supplier/payment fields) is gone. Replaced by three focused dialogs, opened from a row's dropdown menu: **Add Stock**, **Reduce Stock**, **Count Stock** (`ReasonCodeSelect` for reason codes, `InventoryApis.addStock`/`reduceStock`/`stockCountCorrection`). None of these create a purchase, expense, payment, or supplier transaction — the mandated warning copy says so and the UI shows previous/movement/resulting quantity from the response. The item-creation dialog's opening-stock payment flow (`opening_stock_account_type`/`opening_stock_account_id` via `CashBankAccountSelect`) is untouched — that's a separate, still-live code path for initializing a new item's stock.
- **`app/(dashboard)/inventory/purchases/`** and **`.../purchases/returns/`** — new pages for the Purchase and Purchase Return lifecycle (draft → ordered → posted via partial receiving → voided). `PurchaseLineItemsEditor` (`components/purchases/`) supports picking an existing item or inline-creating a new one, with a duplicate-item warning check before confirming a new item.
- **Navigation**: "Purchases" nav entries across the sidebar, finance home, and global search now point to `/inventory/purchases` (not the old `/finance/purchases`). The one exception: `app/(dashboard)/manage/page.tsx`'s "Equipment & supplies" card was repointed to `/finance/expenses` instead, since that card specifically described non-inventory purchases (this was a deliberate, user-confirmed correction — general "Purchases" nav → new inventory-linked flow, but the equipment/supplies-specific card → Expenses).
- **`components/finance/workspace/finance-transactions-client.tsx`**'s `ownerLink()` resolver checks `non_inventory_purchase` (→ Expenses) before the generic `"purchase"` substring match (→ old `/finance/purchases`, which is still where legacy `general_purchase`/`general_purchase_return`-sourced rows live), and `inventory_purchase` (→ new `/inventory/purchases`) — order matters here since `non_inventory_purchase` also contains the substring `"purchase"`.
- The old `/finance/purchases` workspace (`purchases-workspace.tsx`,
  `purchase-dialog.tsx`) is **not deleted**, just unlinked from navigation. It
  remains for historical `GeneralPurchase` audit/rollback during the controlled
  cutover; current Flutter does not depend on this legacy workspace.
- Purchase Return `refund_received` requires an exact eligible
  drawer/bank/custom account. The client sends `account_type`/`account_id`; the
  backend posts one refund inflow and the return void posts its compensating
  outflow. `supplier_credit` deliberately has no custody selector.

### Conventions this codebase follows (confirmed by audit, not assumed — don't reintroduce different patterns)

- Forms: plain `useState` + manual inline validation. `react-hook-form`+`zod` exists but is confined to 4 unrelated menu/discount dialogs.
- Toasts: `sonner`'s `toast.success()/.error()` for new standalone components; `inventory/page.tsx` specifically keeps using its existing `useToast()` hook for internal consistency within that one file.
- Item/entity pickers: plain Radix `Select` — no `cmdk`/search-combobox exists anywhere in this codebase.
- Multi-line editors: array-of-objects + stable `crypto.randomUUID()` keys (see `AllocationLinesEditor`, `InventoryConsumptionDialog`'s `DraftLine[]`, `PurchaseLineItemsEditor`).
- Dialogs: shadcn `Dialog`/`DialogContent` controlled via `open`/`onOpenChange` state (not `DialogTrigger`).

## Test suite note

`scripts/__tests__/finance-reporting-ui-contract.test.js` has a set of **pre-existing failures unrelated to any inventory/purchase work** — as of 2026-08-28, 11 tests fail identically regardless of inventory-refactor changes (income page, analytics finance summary, business-line scope, payable payments, an untouched expense-page assertion, the legacy `purchase-dialog.tsx` supplier-requirement check, etc.), traced to other uncommitted work in this repo. Before assuming a red test here is something you broke, `git stash` just your changed file(s) and re-run — if the failure persists identically, it's pre-existing and out of scope. Two tests that *were* genuine regressions from the inventory-page redesign have already been fixed by retargeting their assertions at the new dialogs/pages instead of the deleted `adjustForm`-based one.
