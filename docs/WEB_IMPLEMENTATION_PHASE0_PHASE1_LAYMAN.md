# Phase 0 + Phase 1 Features (Layman English)

This is a plain-English version of what we’d build first, based on `docs/WEB_IMPLEMENTATION_BACKLOG_2026-04-07_IMPLEMENTATION.md`.

## Phase 0 (Prep)

- Add the missing “API links” the app needs so screens can talk to the backend for the new features (payroll PDF, analytics detail views, period snapshots/rebuild, day-close exports and adjustments).
- Make the code consistent by adding a proper named API entry for “my profile” (instead of calling the URL directly in one place).
- Quick smoke-check that the backend responses match what the UI expects (so we don’t build the wrong forms/tables).

## Phase 1 (P0 Features)

### Payroll (Full workflow)

- A “Create Payroll Run” screen so an admin can start a payroll for a date range.
- A “Payroll Run Detail” screen so clicking a payroll row opens the run (right now it navigates to a page that doesn’t exist).
- Buttons on the payroll detail screen to:
- Approve the payroll.
- Mark it as paid (with payment info like reference/date/method).
- Cancel it (with a reason).
- Add or remove staff adjustments (extra pay or deductions).
- Download/print the payroll PDF.

### Analytics (More than just the dashboard)

- New pages that answer “show me the details” instead of just summary tiles:
- Menu analytics details (what items are selling, how they perform).
- Staff analytics details (who sold what, performance breakdown).
- Kitchen analytics details (prep times, tickets, bottlenecks).
- Inventory analytics details (stock usage, variance, trends).
- Optional “compare” view (compare one period vs another).

### Period Reports (Rebuild + Snapshot)

- For weekly/monthly closes, add:
- “View snapshot” (see what the numbers looked like at the time of closing).
- “Rebuild” (recalculate a closed period if something changed or was fixed).

### Day Close (Fixes + audit + exports)

- A screen to view past day closes (history).
- Ability to reopen/correct a closed day close with a reason (audit trail).
- Add income/expense adjustments after close (with a clear list/ledger view).
- Export day close reports to PDF/Excel.

