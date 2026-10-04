# Permission-related browser log fixes — 2026-10-04

Local frontend changes; no commit or push; no account permission records changed.

## Confirmed and corrected

- Dashboard optional staff/table/menu requests now follow their backend permission requirements. Revoked grants clear previously loaded optional data. Late staff responses cannot restore data after revocation.
- The dashboard staff panel, day-close log link, and summary export control are permission gated. The export handler also checks the grant.
- Read-only Menu Categories no longer requests unauthorized inventory stations. Station lookup failure cannot discard successfully fetched categories; restricted station metadata is omitted.
- Browser clients and incomplete Electron bridges cannot claim KOTs for automatic printing. Claiming requires a supported print path for the selected printer. Other-terminal claim protection remains in place.

## Verification

- Focused Vitest run: 37 passed across 6 files, including 13 tests added for these changes.
- Related Node contract tests: 24 passed (canonical print routing, dashboard polish, menu UI).
- TypeScript: `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Real browser login as the requested Casey account (ID 505): dashboard loaded with restricted staff, shift-log, and export controls absent; categories populated with no station requests, no category error, and no edit buttons.
- Fresh local authenticated notification WebSocket handshake for ID 505 reached Open. The original historical socket failure was not reproduced with fresh authentication; no socket code changed.

## Broader suite remains unresolved

The broad Vitest run reported 228 passed and 7 failed tests; 55 passed and 41 failed files. Of the failed files, 39 are Node `node:test` contract files collected by Vitest, which reports "No test suite found". The seven assertion failures are in the hotel inventory tests (six) and day-close presentation copy (one). These are not a claim of a green full repository suite. The following are the exact failed file/case names from that run:

- FAIL  scripts/__tests__/accounting-ui-contract.test.js [ scripts/__tests__/accounting-ui-contract.test.js ]
- FAIL  scripts/__tests__/analytics-ui-contract.test.js [ scripts/__tests__/analytics-ui-contract.test.js ]
- FAIL  scripts/__tests__/branding-settings-ui-contract.test.js [ scripts/__tests__/branding-settings-ui-contract.test.js ]
- FAIL  scripts/__tests__/business-profile-ui-contract.test.js [ scripts/__tests__/business-profile-ui-contract.test.js ]
- FAIL  scripts/__tests__/canonical-print-routing-contract.test.js [ scripts/__tests__/canonical-print-routing-contract.test.js ]
- FAIL  scripts/__tests__/cash-banks-ui-contract.test.js [ scripts/__tests__/cash-banks-ui-contract.test.js ]
- FAIL  scripts/__tests__/dashboard-polish-contract.test.js [ scripts/__tests__/dashboard-polish-contract.test.js ]
- FAIL  scripts/__tests__/day-close-control-ui-contract.test.js [ scripts/__tests__/day-close-control-ui-contract.test.js ]
- FAIL  scripts/__tests__/day-close-mobile-flow-ui-contract.test.js [ scripts/__tests__/day-close-mobile-flow-ui-contract.test.js ]
- FAIL  scripts/__tests__/day-close-rich-evidence-ui-contract.test.js [ scripts/__tests__/day-close-rich-evidence-ui-contract.test.js ]
- FAIL  scripts/__tests__/design-system-gallery-route-contract.test.js [ scripts/__tests__/design-system-gallery-route-contract.test.js ]
- FAIL  scripts/__tests__/finance-mobile-navigation-contract.test.js [ scripts/__tests__/finance-mobile-navigation-contract.test.js ]
- FAIL  scripts/__tests__/finance-reporting-ui-contract.test.js [ scripts/__tests__/finance-reporting-ui-contract.test.js ]
- FAIL  scripts/__tests__/finance-settings-ui-contract.test.js [ scripts/__tests__/finance-settings-ui-contract.test.js ]
- FAIL  scripts/__tests__/finance-wave-one-ui-contract.test.js [ scripts/__tests__/finance-wave-one-ui-contract.test.js ]
- FAIL  scripts/__tests__/finance-wave-two-b-final-ux-contract.test.js [ scripts/__tests__/finance-wave-two-b-final-ux-contract.test.js ]
- FAIL  scripts/__tests__/finance-wave-two-ui-contract.test.js [ scripts/__tests__/finance-wave-two-ui-contract.test.js ]
- FAIL  scripts/__tests__/hardware-documents-settings-ui-contract.test.js [ scripts/__tests__/hardware-documents-settings-ui-contract.test.js ]
- FAIL  scripts/__tests__/inventory-operational-ui-contract.test.js [ scripts/__tests__/inventory-operational-ui-contract.test.js ]
- FAIL  scripts/__tests__/kitchen-wave-four-ui-contract.test.js [ scripts/__tests__/kitchen-wave-four-ui-contract.test.js ]
- FAIL  scripts/__tests__/manage-ui-contract.test.js [ scripts/__tests__/manage-ui-contract.test.js ]
- FAIL  scripts/__tests__/menu-wave-five-ui-contract.test.js [ scripts/__tests__/menu-wave-five-ui-contract.test.js ]
- FAIL  scripts/__tests__/mobile-dashboard-home-contract.test.js [ scripts/__tests__/mobile-dashboard-home-contract.test.js ]
- FAIL  scripts/__tests__/mobile-dashboard-promo-carousel-contract.test.js [ scripts/__tests__/mobile-dashboard-promo-carousel-contract.test.js ]
- FAIL  scripts/__tests__/mobile-register-toolbar-ui-contract.test.js [ scripts/__tests__/mobile-register-toolbar-ui-contract.test.js ]
- FAIL  scripts/__tests__/navbar-help-tour-contract.test.js [ scripts/__tests__/navbar-help-tour-contract.test.js ]
- FAIL  scripts/__tests__/orders-wave-three-ui-contract.test.js [ scripts/__tests__/orders-wave-three-ui-contract.test.js ]
- FAIL  scripts/__tests__/party-workspace-ui-contract.test.js [ scripts/__tests__/party-workspace-ui-contract.test.js ]
- FAIL  scripts/__tests__/people-access-settings-ui-contract.test.js [ scripts/__tests__/people-access-settings-ui-contract.test.js ]
- FAIL  scripts/__tests__/profile-page-contract.test.js [ scripts/__tests__/profile-page-contract.test.js ]
- FAIL  scripts/__tests__/settings-navigation-contract.test.js [ scripts/__tests__/settings-navigation-contract.test.js ]
- FAIL  scripts/__tests__/sidebar-plan-billing-contract.test.js [ scripts/__tests__/sidebar-plan-billing-contract.test.js ]
- FAIL  scripts/__tests__/staff-detail-final-polish-ui-contract.test.js [ scripts/__tests__/staff-detail-final-polish-ui-contract.test.js ]
- FAIL  scripts/__tests__/staff-edit-access-ui-contract.test.js [ scripts/__tests__/staff-edit-access-ui-contract.test.js ]
- FAIL  scripts/__tests__/staff-overview-ui-contract.test.js [ scripts/__tests__/staff-overview-ui-contract.test.js ]
- FAIL  scripts/__tests__/staff-register-ui-contract.test.js [ scripts/__tests__/staff-register-ui-contract.test.js ]
- FAIL  scripts/__tests__/transaction-detail-ui-contract.test.js [ scripts/__tests__/transaction-detail-ui-contract.test.js ]
- FAIL  scripts/__tests__/wave-six-ui-contract.test.js [ scripts/__tests__/wave-six-ui-contract.test.js ]
- FAIL  scripts/__tests__/workforce-ui-contract.test.js [ scripts/__tests__/workforce-ui-contract.test.js ]
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > opens the selected room booking directly from the buildings screen
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > opens floor management without opening a booking
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > shows every floor and filters full-width buildings without opening another screen
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > places a room into an exact floor grid position
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > swaps rooms when a room is dropped onto an occupied grid position
- FAIL  components/hotel/inventory-panel.test.tsx > InventoryPanel building-first room flow > exposes removal controls for buildings, rooms, and floors
- FAIL  lib/presentation/day-close.test.ts > day close presentation > maps ACCOUNTING_REVIEW_REQUIRED to manager copy
