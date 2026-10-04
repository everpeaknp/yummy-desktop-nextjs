# Dashboard and shared-shell permission audit — 2026-10-04

Scope: local frontend follow-up approved by the user. No commits or pushes. No role grants or backend records changed.

## Changes

- Dashboard navigation and route access continue to require dashboard.view. Waiter landing priority remains Orders; station roles prefer Kitchen. Custom roles with explicit permissions now select an allowed destination, including accounting-only, bar-only, and empty permission sets. They no longer fall back to an inaccessible Dashboard just because they belong to a restaurant.
- Navbar LiveStats extracted to components/layout/live-stats.tsx. It skips dashboard requests without dashboard.view, hides Orders/KOT links without POS route access, and hides Sales without reports.analytics.view. Permission revocation and account changes invalidate pending responses and clear stale statistics.
- Mobile primary navigation deduplicates destinations and filters all links by route access.
- Dashboard financial sections on desktop and mobile require reports.analytics.view: Sales/Refund metrics, sales trend, financial summary/payment mix, top item revenue, revenue-source panel, selected-period highlights, collections and money snapshot, and mobile insights. Financial summary export requires analytics access plus reports.export in both control and handler.
- Account dropdown hides Business Profile and Settings without their route access. Brand links and explicit parent/back links resolve to permitted routes. Business-module redirects use allowed landing destinations. Access Denied copy no longer promises Dashboard for every user.
- Existing global search and help shortcuts were inspected: both already filter routes using permission helpers.

## Evidence

Regression failures reproduced before fixes: custom accounting/bar/empty tenant landing routes; financial dashboard panel exposure; export without analytics.

Focused final run: 45 tests passed across 7 files (role-permissions, sidebar, navbar statistics, mobile navigation, desktop/mobile dashboard, dashboard data hook).
TypeScript: npx tsc --noEmit --pretty false passed. git diff --check passed.
Node contract checks: 24 passed (canonical print routing, dashboard polish, menu wave-five).

Full suite run before the final export regression: 247 passed, 7 failed; 59 passed and 41 failed files. The 39 Node test files incorrectly collected by Vitest still report no test suite. Six hotel inventory component cases and one day-close presentation case still fail, matching the preceding audit. Full output retained at /tmp/yummy-shell-full.txt.

Real browser: current Casey session (UI name Ramon, waiter) on localhost:3001. Desktop financial summary, sales chart, navbar sales, and staff panel counts were zero. Account menu contained personal profile, feedback, help, theme and logout, with no Business Profile or Settings. At 390x844, money snapshot, top item revenue and insights were absent; operational cards remained. Home link href was /orders/active; direct navigation loaded the canonical /orders screen. Existing dashboard.view grant means Dashboard remains visible for this account. Temporary browser tab closed and viewport reset.

## Limits

This pass does not establish that every deep-screen button or every permission combination has been exercised in a real browser. No new live role permutations were assigned. Restricted/custom-role cases were exercised through rendered component tests and the real route/sidebar logic. Existing account grants were preserved.

Backend default waiter and kitchen/bar/cafe/barista templates currently include dashboard.view. This audit does not remove that template grant or existing user grants. Dashboard access is decided by effective permissions, not the waiter label.

UI visibility is not backend authorization: the dashboard response may still contain broader fields. Server response minimization and the separate previously identified backend audit findings remain outside this frontend pass.
