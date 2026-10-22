# Attendance and payroll: whole-flow audit and refactor study

Date: 20 October 2026. Status: analysis and proposal, not an implementation specification approved for release.

## 1. Outcome

The main problem is not the appearance of individual cards. Attendance planning, physical presence, exception review, period reporting, salary accrual, outstanding balances, and payments are presented as loosely connected features. They use different periods and different definitions of apparently identical numbers.

Adding another report below the schedule table will not solve this. The stronger approach is to establish shared definitions and drilldowns, then organize the existing functionality around three jobs:

1. Run today's shift: who should be here, who is here, and what needs attention?
2. Review a period: what happened for each employee, on which dates, and why?
3. Explain and pay salary: how was the amount earned, what is withheld or already settled, and what payment will be recorded?

Do not describe the payroll system as fully validated yet. Source inspection found risks involving historical rates, hourly overtime, unscheduled work, and the meaning of finalization. A cleaner interface must not conceal these.

## 2. Scope and evidence boundary

Inspected current routes, callers, UI state, repositories/API wrappers, backend controllers, calculation and payment services, and relevant test inventory in:

- **W**: `C:/Users/PREDATOR/OneDrive/Desktop/yummy-desktop-nextjs`, branch `ref/hotel`.
- **F**: `C:/flutter applications/yummy`, branch `ref/hotel`.
- **B**: `C:/yummy_backend`, branch `test`.

Web already had uncommitted attendance changes; this audit treats those as current source and preserves them. Flutter and backend were clean when inspected. No application code, database records, permission settings, or deployment configuration were changed for this study.

This is source-code verification, not a browser/device usability test or a deployed payroll reconciliation. Historical screenshots inform the problem but do not establish current deployed behavior. Existing tests were located and inspected by topic, not executed in this pass. The seeded cohort is useful test input, not independent proof that all displayed totals are correct.

Design guidance: preserve Yummy's existing web components/tokens and Flutter's theme, Poppins, orange identity, compact grouped rows, and accessible interaction patterns. The web audit also used the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). No visual mockup, graph build, or new dependency is needed for this investigation.

## 3. Current surface map

| Entry point | What exists | Main problem to solve |
|---|---|---|
| Workforce home | Working-now/review/salary-due summaries; directory, attendance and bulk payment links | Counts are entry-based; pay-all settles outstanding balances, not a reviewed period; task links lose context |
| Attendance overview | Entry counts, active entries, exception list | Does not answer who was expected but never arrived; accepted warnings can remain in the exception queue |
| Timesheets | Entry-level correction, review, approval/rejection, CSV, finalization | Approval workflow dominates; records lack a unified day explanation and discoverable audit drilldown |
| Schedule | Team week, bulk roster, individual changes, templates, schedule audit | Also contains daily and period reports; operational planning becomes a long mixed-purpose page |
| Leave & holidays | Requests, approval actions, holiday configuration | Request count versus leave days is unclear elsewhere; half-day and working-on-holiday states disappear in schedule projection |
| QR, devices, settings | Clocking configuration, kiosk, physical-device setup, policy | Setup occupies the same primary navigation level as daily operational tasks |
| Payroll export/review | A period estimate table plus attendance-minutes export | Estimate, CSV, attendance lock, salary payment and employee statement are separate journeys |
| Staff list/detail | Overview, Attendance, Financials, Performance, Employment, Access, Activity | Attendance uses raw schedule rules again; finance mixes lifetime balances, contract history and transactions |
| Staff Financials | Salary accrued/paid/pending, pay/deduct, separate overtime, advances/repayments | No single explanation of selected-period earnings versus total amount owed; loan repayment is not salary settlement |
| User profile | Today's/recent attendance widget and personal attendance link | Older latest entry can be described as today's state; profile is another summary implementation |
| My attendance | QR action, personal records, salary balance, week, leave and holidays | Record date filter does not filter salary or all leave data; no complete personal period statement |
| Finance expenses/transactions/ledger | Posted salary/overtime cash events | Generic salary transaction link returns to Attendance, not the staff payment/statement that explains the entry |

### Platform coverage is not equivalent

- Web's manager implementation is `W/components/attendance/attendance-admin-client.tsx`; scheduling is `W/app/(dashboard)/attendance/schedule/page.tsx` embedded in that workspace.
- Flutter `/workforce/attendance` routes to `F/lib/features/staff/presentation/web/attendance_admin_screen.dart`. Despite the directory name, this is a routed Flutter surface, not something to ignore as web-only.
- Flutter `/attendance` is the personal `attendance_screen.dart`; `/workforce/staff-detail` and legacy `/staff-detail` route to different staff detail implementations. Both have attendance/financial functionality.
- Flutter also contains `AttendanceManagementScreen`, but no construction caller was found. Do not spend redesign effort on that shell without establishing a live caller.
- Flutter's current manager tabs do not include web's new payroll-review tab. Its schedule contains a range report but not the newly added web daily panel.
- Flutter personal attendance has a Request leave action; the inspected Next.js personal page does not. Shared policy does not currently mean feature parity.

Routing evidence: `F/lib/core/routes/app_router.dart:1496`; surface definitions: `F/lib/features/staff/presentation/web/attendance_admin_screen.dart:28`, `F/lib/features/attendance/presentation/screens/attendance_screen.dart:27`.

## 4. Findings that affect trust, not just appearance

Priorities below describe refactor/release importance. They do not imply a production incident was reproduced.

### A. Historical salary is recalculated from current salary fields — high priority

`StaffSalaryService.compute_balance`, `preview_attendance_period` and `_daily_rate` use the current Staff salary amount/type. A salary-history service exists, but this calculation path does not segment the range by those effective-dated history records. The attendance-based toggle is also an immediate current-field change.

Consequence: a historical report or accumulated balance can change after a salary/mode change, despite the UI showing an effective date. Shift resolution also uses current policy/template data, so historical stability needs explicit verification beyond rates.

Smallest stronger alternative: calculate effective employment/rate/policy segments on the server; explain the segments in the pay detail. Preserve finalized monetary results rather than implying an attendance-status lock freezes money.

Evidence: `B/app/services/staff_salary_service.py:211`, `:226`, `:266`, `:872`; `B/app/services/workforce_policy_service.py:294`.

### B. Hourly overtime has two payable paths — high priority

Attendance accrual adds hourly overtime pay. A separate outstanding-overtime endpoint and Pay overtime action remain available. That action writes `overtime_paid`, but `compute_balance` subtracts salary-paid and salary-deducted totals, not overtime-paid. The accrual path does not exclude overtime resolved by that separate action.

Consequence: the same hourly overtime can remain inside outstanding accrued salary after being paid separately. This is a source-confirmed conflicting path; actual double payment was not executed.

Smallest stronger alternative: choose one settlement mechanism and link each earning component to its settlement. Do not merely hide a button on one client. Salaried overtime policy must remain explicit rather than being silently changed to match hourly policy.

Evidence: `B/app/services/staff_salary_service.py:452`, `:242`, `:792`, `:805`; `B/app/repositories/staff_credit_repository.py:307`; `W/components/staff/staff-salary-card.tsx` and both Flutter salary panels.

### C. No schedule is treated as a paid day off — high priority

The shift resolver returns no scheduled timestamps for both missing assignment and explicit day off. Accrual then adds the daily rate and continues before processing actual entries, leave or holidays. For hourly staff that rate is zero, so approved work without a scheduled shift is skipped by this path. Daily-rate staff also accrue on these off/missing-schedule days under current behavior.

Consequence: a setup omission can look like a legitimate day off; accepted unscheduled work can be unpaid for hourly staff. A green present badge alone would not resolve the pay discrepancy.

Smallest stronger alternative: distinguish unassigned, explicit day off and scheduled work in the shared result. Show missing schedule as a setup issue, not an invented absence or paid day off. Agree the daily-rate/rest-day and unscheduled-work policies before changing formulas.

Evidence: `B/app/services/attendance_policy_service.py:76`; `B/app/services/staff_salary_service.py:376`.

### D. Presence, approval and payable time are inconsistent — high priority

- The week projection reports present when any entry is approved/exported, and review when entries exist but none meet that condition.
- Holiday and leave branches return before attaching attendance outcomes. Day-off cells likewise do not expose the outcome. Actual work on those dates is hidden by this projection.
- Absence is derived from a past calendar date with no entry, not from the expected shift having ended. Today's missed shift and cross-midnight work need different handling.
- The period staff report counts approved/exported dates as present but sums regular/overtime minutes before applying that approval filter. Rejected/pending time can therefore appear beside approved present-day totals.
- Overview sums entries without the same exclusions; approved totals omit exported status.

Smallest stronger alternative: one server-owned per-person/per-workday result, with separate presence, review and pay eligibility. Derive daily tiles, period reports, personal views and exports from it.

Evidence: `B/app/services/attendance_service.py:793`, `:1056`; `B/app/services/attendance_report_service.py:23`; `W/app/(dashboard)/attendance/schedule/page.tsx:300`.

### E. “Finalize payroll period” does not finalize a salary statement — high priority

The action marks approved entries as `payroll_exported` and audits them. It does not snapshot earnings/rates/leave, create a payroll run or pay anyone. Unresolved records are not a precondition that blocks this operation. The separate salary-pay flows are lifetime balance transactions.

Smallest stronger alternative now: label this operation accurately as locking approved attendance and explain exclusions. A future payroll-finalization flow requires a monetary snapshot and settlement design; it is not a text-only change.

Evidence: `B/app/services/attendance_service.py:1010`; `W/components/attendance/attendance-admin-client.tsx:1705`; `W/components/staff/pay-all-preview-dialog.tsx:77`.

### F. Salary visibility needs a backend permission review — high priority

The new monetary preview uses `attendance.payroll.export`, while Staff Financials uses credit/payroll view/manage permissions in the UI. Staff salary-balance/profile/balances read routes inherit `admin.staff.view` and do not show an additional payroll-read requirement in the inspected controller/service path.

Consequence: hiding a finance tab is not evidence that a directory-only manager cannot fetch salary data. These are restaurant-scoped paths, not evidence of cross-restaurant leakage.

Smallest stronger alternative: agree a role/field visibility contract, enforce it server-side, and test directory-only, attendance-only, payroll and self-service roles. Do not silently change authorization during the visual refactor.

Evidence: `B/app/controller/staff_controller.py:42`, `:56`, `:329`, `:385`; `B/app/controller/attendance_controller.py:640`; `W/app/(dashboard)/staff/[id]/page.tsx:406`.

### G. Some settings suggest rules that calculations do not apply

Full-day and half-day minimum percentages are displayed and persisted, but the inspected computation/report paths do not use them. Salaried attendance pay instead derives a ratio from late/early minutes and buffers. Monthly flat rate is currently amount / 30; weekly is amount / 7.

Smallest stronger alternative: show the actual active pay policy and remove misleading expectations. A custom report date range supports selecting a Nepali-month span, but does not by itself implement Nepali-month salary proration or a different divisor. Those are separate policy decisions.

Evidence: `W/components/attendance/attendance-admin-client.tsx:2061`; `B/app/services/staff_salary_service.py:211`, `:497`; backend search finds threshold fields in settings/schema/model code, not consumption in calculation services.

### H. Advance repayment and salary deduction are different operations

Staff credit repayment posts an account inflow. Salary deduction reduces salary balance through a separate transaction. A repayment reason such as “Deducted from salary” does not create a linked non-cash salary-offset transaction.

Smallest stronger alternative: keep “staff owes restaurant” distinct from “restaurant owes staff.” Do not automatically net them. If salary recovery of an advance is desired, it needs an explicit authorized settlement that updates both sides without inventing cash movement.

Evidence: `B/app/services/staff_credit_service.py:277`; `W/components/staff/staff-credit-card.tsx:386`; `B/app/controller/staff_controller.py:56`.

## 5. UX findings across the journey

| Finding | Effect on the user | Smallest useful correction |
|---|---|---|
| Reports live below the roster, templates and setup share the page | Managers hunt for routine results | Make Today and Reports primary; keep Schedule for planning |
| Today, selected-period, and lifetime numbers appear together without scope labels | “Why is accrued 5,000?” cannot be answered from the screen | Label every metric's period and source; distinguish earnings from outstanding balance |
| Present means approved, rather than observable attendance | Staff who arrived can look absent/not present while awaiting review | Separate physical presence from payroll review |
| An accepted exception remains in an exception-code filter | Managers repeatedly inspect already-resolved work | Show unresolved review tasks; keep historical warnings in detail |
| Staff attendance repeats raw recurring rules | Old/overlapping rules return as an unreadable list | Reuse exact-date schedule projection and day detail |
| Personal approved leave is a count of requests | Half-day and multi-day requests produce misleading totals | Show leave days in selected period, with request count only in Requests |
| Record filters do not filter personal accrued salary/all leave requests | Changing a range appears to leave unrelated totals unchanged | One reporting range; clearly separate live clocking and lifetime balances |
| “Today” can use a latest historical entry | A person appears clocked out today without today's attendance | Use restaurant-local current workday/active shift plus next expected shift |
| Summary hours are rounded to 0.1h | A few worked minutes appear as 0.0h | Use hours/minutes operationally; decimal hours only where useful for formulas/export |
| Payroll review exports a different minutes dataset | Export does not explain the money in the table | Explicit export types, each matching its displayed report and period |
| Salary history means both transactions and compensation changes | Users cannot tell what changed pay versus what was paid | Separate Pay statements, Payments, Adjustments and Compensation history |
| Finance salary transaction points to generic Attendance | Payment cannot be reconciled back to its employee/context | Deep-link to staff/payment detail with back navigation |
| Entry reads capped at 100/200/300, not visibly paginated | Long periods can look complete while records are truncated | Server totals plus paginated detail and complete server export |
| Silent failures preserve old data or become empty reports | “No records/zero” is confused with “could not load” | Section error/retry states, last-loaded range, and stale-response protection |

Evidence highlights:

- `W/app/(dashboard)/attendance/me/page.tsx:38`: mixed-scoped requests, limit 100, fulfilled-only updates; `:75`: lifetime pay/request-count summaries.
- `W/app/(dashboard)/attendance/schedule/page.tsx:81`: failed report becomes empty; `:101`: scheduled count exists but not included in the displayed four totals; `:265`: report embedded in scheduling.
- `W/app/(dashboard)/staff/[id]/page.tsx:956`: correction toast still says returned to draft; `:2400`: raw assigned-rule list.
- `W/components/attendance/attendance-admin-client.tsx:557`: entry limits; `:1510`: date inputs without associated labels/accessibility names; `:1736`: monetary review versus minutes export.
- `W/components/finance/workspace/finance-transactions-client.tsx:131`: salary link returns to generic attendance.
- `F/lib/features/attendance/presentation/screens/attendance_screen.dart:183`, `:422`: same personal loading/scope/summary problems.
- `F/lib/features/staff_detail/presentation/widgets/staff_workspace/staff_attendance_tab.dart`: submit/approve language and raw schedules in legacy detail.

Source-confirmed web accessibility issue: manager date controls have no associated labels or aria-labels. Broader keyboard focus, contrast, dark-mode and responsive quality still require rendered testing; they are not claimed as verified failures. Date filters should have visible labels even where aria-labels already exist.

## 6. Proposed information architecture

This is a user-facing structure, not authorization to rename routes or delete existing endpoints.

```text
Workforce home — short task summary and links
  Attendance
    Today / Daily view
    Reports
    Schedule
    Leave & holidays
    Setup: QR kiosk, devices, attendance policy
  Payroll — period review, explanations and settlements
  Staff directory
    Staff profile
      Overview
      Attendance — same report, scoped to this employee
      Financials — pay summary, statements/payments, advances
      Employment / Access / Activity — existing responsibilities

My profile
  My attendance & pay — own data, self-service actions only

Finance transaction / ledger
  Linked staff payment or statement detail
```

Keep existing URLs/deep links working during migration. Payroll can initially reuse the current route/tab container; a new top-level route is not a prerequisite. Use one report definition and permission contract, with platform-specific presentation. Do not attempt one giant universal component.

## 7. Screen-by-screen proposed behavior

### Today / Daily attendance — the manager's default

- Date header, previous/next day, Today shortcut, restaurant timezone, last updated time and refresh.
- Compact metrics for expected staff, working now, not arrived, completed, absent, and leave/day off. Counts must reconcile to distinct staff in scope; “needs review” is an overlapping task count, not another presence category.
- Searchable staff rows: employee/role, planned shift, current outcome, actual in/out, net worked time, and exception/action.
- Future shift: Not started. Started shift without a punch: Not arrived/late. Only a concluded expected shift can become Absent under the agreed rule. Overnight open shifts remain working, not yesterday's absence.
- Leave/dayoff/holiday is contextual, not a reason to hide work. Examples: “Holiday · worked 6h”, “Half-day leave · expected 4h”.
- Click a row for the day timeline and explanation, not a new generic profile page. Allow eligible correction/review from that context.
- End-of-day view uses the same date and rows: completed work, absence, missing checkouts and unresolved exceptions. Export the daily report with names, expected/actual times and statuses.
- Normal valid attendance stays automatic. No daily approve-everyone ceremony and no mandatory day-close action merely to view a report.

### Reports — the HR/period workspace

- One explicit From/To range, Today/Week/Month presets and previous/next period. Custom dates remain primary enough to support a chosen BS-month span without forcing Gregorian boundaries.
- View modes: summary by staff, daily register, and one employee's day-by-day detail. Same range, filters and totals throughout.
- Default staff columns: employee, scheduled days, attended days, absent days, paid/unpaid leave days, regular hours, overtime hours, unresolved items. Late/early minutes, holidays/dayoffs and pay can be optional detail columns.
- Show approval-eligible hours separately from recorded attendance where they differ. Do not describe all observed time as payable.
- Payroll estimate column only for authorized roles and only when explicitly requested; it should link to the explanation, not be an unexplained total.
- Staff name/day drilldowns preserve date/filter context. Export uses the same server result; display total record count and pagination.
- Do not call missing historical setup “absent.” Mark unassigned/unknown dates and explain coverage limitations.

### Schedule — planning, not another reporting dashboard

- Week range and exact dates, previous/next week, Today. The week-containing date control must explain the displayed week.
- Team grid remains primary. Bulk assignment can be an action panel rather than a permanently large form ahead of every row.
- Future cells editable according to existing permissions; past schedules stay locked.
- Past cells show shift plus a text/icon outcome, with semantic green/red/amber as reinforcement. Clicking opens day detail; it does not edit history.
- Explicitly differentiate Day off and Unassigned.
- Keep templates and filtered/paginated audit history secondary, with actor, affected staff/date, old/new value, reason and timestamp when actually recorded. Never invent actors for legacy changes.

### Staff profile → Attendance

Reuse the period report scoped to that person: summary, daily register, schedule history and leave breakdown. Do not maintain a separate approval UI with different actions/messages. From day detail, link to attendance audit and explain any excluded payable time. Keep edit-employment and access controls outside this tab.

### Staff profile → Financials

1. **Pay for selected period:** earnings estimate or finalized statement, rate/basis and explanation.
2. **Outstanding balance as of [date]:** cumulative amount owed, clearly distinct from period earnings.
3. **Payments and adjustments:** amount, date, account/reference, actor/reason and linked statement where available.
4. **Advances:** money staff owe the restaurant, displayed separately; no silent netting.
5. **Compensation:** salary agreement, expected hours, effective dates and policy links; detailed editing remains in Employment.

Move unrelated staff-purchase discount out of the salary explanation. Rename “Pending” to “Outstanding salary” where that is the actual meaning. Deduction forms must warn against re-entering an absence adjustment already included in earnings.

### My profile → My attendance & pay

Profile shows only a compact live shift and shortcut. The full personal workspace provides Today, History, Schedule, Leave and Pay views adapted for mobile.

- QR/clocking action remains immediately accessible and independent of historical filters.
- Personal history uses the same workday/result definitions as managers, without other employees or administrative actions.
- Leave requests and day totals are distinct; parity includes the existing Flutter request flow on the web.
- Pay explains the selected period's earnings, statement status, payments and outstanding balance. A policy-controlled estimate must be clearly labeled as an estimate.
- Show the reason a record is under review and the next step; a correction-request mechanism is a separate future workflow, not an existing capability to imply.
- Scanner states need explicit camera/location permission, processing, expired QR, retry and successful receipt. This proposal does not reintroduce mobile approval, WiFi checks or new identity policy.

### Payroll workspace

Recommended future flow: choose period → inspect employee summaries → resolve blocking exceptions → review calculations → finalize a statement/run → record payments → view/export statements and payment history.

Do not enforce a ceremonial review on every clean entry. Focus on blockers and changed results. If part-payment or exclusion is allowed, record exactly what is deferred.

Each employee's explanation should show:

- Period and employment coverage; salary basis/rate and each effective rate segment.
- Regular work, paid leave, paid holiday and paid rest-day components separately.
- Overtime hours, rate/multiplier and whether already included in regular earnings presentation.
- Absence/late/early effects and authorized adjustments, without subtracting the same loss twice.
- Period earnings, settlement allocations and remaining statement balance.
- Separately, cumulative unpaid balance if the product still supports continuous accrual.

Do not display invented precision. Every amount must trace to server-provided components, with a consistent rounding policy. Existing salary/account/finance posting infrastructure should be reused; introducing a second independent payment ledger would worsen reconciliation.

### Finance integration

Finance should continue to show actual posted payment/account movements. Attendance estimates are not cash payments. Link salary/overtime transactions to the staff and relevant payment/statement, preserving source IDs and audit information. Provide a clear return to the transaction/ledger. Do not recalculate salary inside Finance UI.

## 8. Shared definitions and data requirements

Use one backend-owned daily result with independent fields for:

- Employee and employment eligibility; restaurant-local work date; scheduled start/end including overnight boundary.
- Schedule state: assigned, explicit day off, unassigned; leave fraction/type and holiday context.
- Physical state: not started, not arrived, working, completed, absent, unknown. Multiple punches/shifts retain their own details.
- Observed times, breaks and worked duration.
- Review state: clear, needs review, rejected/excluded, attendance locked; explicit reason/action capability.
- Pay eligibility and included/excluded minutes/components. Approval should not erase the fact that a punch occurred.
- Completeness/as-of timestamp, source entries and audit references.

Aggregates must declare whether they count employees, days, requests, entries or hours. Staff present-day counts must deduplicate entries on the same workday. Leave fractions and holiday/dayoff/work can overlap, so label denominators and avoid pretending every metric is mutually exclusive.

Reuse the existing policy resolver and calculation services after their semantics are agreed. Extend read results deliberately; do not combine independently filtered client arrays to invent financial totals. Add pagination without using a capped list as the source of report totals. Fetch only data needed by the active view.

Authorization must distinguish: own attendance/pay; team attendance; correction/approval; schedule management; salary visibility; payroll finalization; payment/adjustment; policy management. UI capability flags improve usability but do not replace server checks.

## 9. Decisions needed before changing payroll behavior

These are product-policy choices, not visual-design decisions or legal recommendations:

1. Is a monthly salary a fixed calendar/BS-month entitlement, a continuous amount/30 daily accrual, or a scheduled-day prorated amount? The current custom report range does not answer this.
2. Are explicit rest days paid for daily-rate staff? What happens when no schedule was configured?
3. How is approved unscheduled/dayoff work paid? How is salaried overtime priced and settled?
4. Does partial attendance pay use actual payable minutes, late/early reductions, or full/half-day thresholds? Only one documented approach should determine each earning component.
5. Does “finalized” mean locked attendance or an immutable monetary statement? What audited adjustment process handles later discoveries?
6. Are salary advances recoverable through payroll, and who authorizes the offset?

Agree these with the restaurant's payroll policy before implementation. Preserve existing behavior until an explicit change and migration strategy are approved.

## 10. Incremental refactor plan

### Phase 1 — definitions and correctness contract

Write example-based expectations for day outcomes and pay components. Resolve the high-priority calculation/visibility findings. Establish effective date and overnight rules. This is the gate before promising reliable statements.

### Phase 2 — operational attendance

Build Today/daily detail and Reports using shared results. Move reports out of Schedule. Keep existing correction actions but consolidate their labels/state rules. Preserve current routes and lock protections.

### Phase 3 — employee-scoped and self-service views

Reuse the report behavior in Staff Attendance and My attendance; correct period scope, leave counts and errors. Make the two Flutter staff entry paths consistent, then determine whether the older route can safely delegate to the maintained implementation.

### Phase 4 — pay explanations and settlement

Introduce period earnings detail and clearly separate cumulative balances. Resolve overtime/advance settlement, then add true statement finalization if approved. Align web, Flutter, bulk-pay preview and Finance links. Never let one surface continue paying through an obsolete conflicting path.

### Phase 5 — hardening and removal of duplicates

Role tests, responsive/device checks, audit drilldowns, pagination, exports and performance. Remove superseded code only after caller verification and backwards-compatible navigation are covered.

No whole-application rewrite, new design system, new chart library or replacement finance ledger is required.

## 11. Validation and acceptance criteria

Use the isolated seeded restaurant and a frozen clock for repeatable scenarios. The existing seed prints the calculator's own results; compare those against independently calculated expectations rather than treating printed totals as an oracle.

Required scenario matrix:

- Clean scheduled day; not-yet-started shift; late arrival; missing checkout; completed absence; overnight shift crossing a day/week/period boundary.
- Multiple entries in one day; partial attendance; pending/rejected/approved/exported entries; approved record with a retained warning.
- Paid/unpaid full/half-day leave with and without work; paid/unpaid holiday with work; explicit day off with work; missing schedule.
- Monthly/weekly/daily/hourly pay; mid-period rate change; attendance-mode change; hire/termination/rehire; future selected range.
- Overtime included once; separate legacy payout; partial payment; advance repayment versus salary offset; deductions and reversed transactions.
- Read-only attendance manager, payroll viewer, payroll payer and employee self-service; direct API calls as well as hidden controls.
- Empty, forbidden, failed and stale requests; over 300 attendance entries; back navigation; custom BS-month date span; CSV equality with on-screen totals.
- Web narrow/wide and keyboard; Flutter narrow/wide and light/dark; long staff names, large currency amounts, camera/location denial and retry.

Acceptance examples:

- A manager can identify expected, working, late/not-arrived and absent people without interpreting raw approval codes.
- An end-of-day report is accessible directly by date, including unresolved items rather than hiding them.
- Daily → period → individual → self views reconcile for the same employee/date/definition.
- Every amount has an understandable, server-backed explanation and an explicit period.
- Changing a future salary does not silently rewrite a finalized historical statement.
- No attendance item is paid twice through the salary and overtime actions.
- A failed request never becomes an apparent zero, absence or “everyone paid.”
- Exported data matches the selected view's scope, status definition and totals.
- A directory-only permission cannot read salaries unless that is the explicitly approved access policy.

Existing regression starting points: `B/tests/staff/test_staff_salary.py`, `B/tests/attendance/test_attendance_reports.py`, calculation/approval/policy tests, `B/tests/finance/test_staff_payroll_posting_spec.py`, and web attendance/salary API/export tests. These are starting points, not evidence that the above matrix currently passes.

## 12. What stays unchanged in this analysis

At the time of this analysis, no code or financial behavior was changed. The implementation status below records subsequent approved work. The study does not authorize reopening historical schedule editing, altering QR identity checks, imposing a new salary policy, changing permissions, or deploying anything.

## 13. Implementation progress — shared attendance reporting

The first bounded implementation covers operational reporting and the web employee/self-service attendance sections. It is **not completion of the payroll/Finance/Flutter refactor**.

### Implemented

- Attendance opens on **Today**: daily staff register with working, not-arrived, absent, leave, holiday, day-off and unassigned states. A date selector supports end-of-day and historical inspection.
- **Reports** has arbitrary From/To dates, Today/This week/This month shortcuts, staff search, review filtering, 25-row pagination and daily CSV export. Custom ranges may cross Gregorian or BS-month boundaries, up to 93 inclusive days. This does not change the salary period/divisor policy.
- A staff row drills into daily outcomes; a daily row opens recorded versus approved time, leave, breaks, lateness, early departure and underlying punches. Manager details link to staff/date-filtered Timesheets with a Show all staff action.
- Staff Attendance and My attendance reuse the report instead of maintaining separate summary definitions. Self-service has no other-staff selector or manager action link.
- Reports are removed from the weekly scheduling page. The existing planner, schedule-outcome badges, template management and audit remain; planner outcome calculation is still a legacy path and must be reconciled in the later hardening pass.
- Personal clock status distinguishes loading/unavailable from clocked out. Earnings are explicitly labeled cumulative/lifetime, not earnings for the attendance filter. Personal holiday cards follow the selected schedule week. A successful QR punch reloads the report.
- Payroll export navigation is labeled **Payroll review**. The attendance locking button says **Lock approved attendance**, without implying a monetary statement was finalized.

### Backend/report contract

- `GET /attendance/register?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&staff_id=...`: existing `attendance.view` permission, restaurant-scoped staff lookup.
- `GET /attendance/me/register?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`: existing `attendance.clock` permission, resolves staff from authenticated identity. Client staff IDs cannot select another employee. Does not create missing employment profiles.
- Response includes restaurant timezone/as-of, staff summaries and work-date rows. Existing shift resolution is reused with preloaded schedules; database query count does not increase per staff/day.
- Recorded presence is independent of pay approval. Rejected/pending punches remain visible as evidence, with review/excluded counts; they are not approved payable time. Void entries are excluded. Multiple punches count once per attended work date.
- Persisted scheduled-start timestamps assign overnight entries to their work date. Saved scheduled times take precedence over edited templates. Open carryover appears today without counting a second attended day. Open-shift minutes do not inflate completed hours.
- Absence requires an employed, scheduled workday whose shift has ended, without attendance/approved leave/holiday. Missing schedules are unassigned, never inferred as day off or absence. Half-day leave is shown fractionally; a precise missing-half-day absence rule remains a policy decision.
- CSV exports all matching daily rows, not just the current page; includes approved/recorded minutes, leave, breaks and lateness. Timestamp headers explicitly identify ISO timestamps; spreadsheet formula cells are escaped.

### Validation and rollout boundary

- Backend regression command (no live database or destructive pytest fixtures): `venv\\Scripts\\python.exe -m unittest discover -s tests/attendance -p test_attendance_register.py`.
- Web: `npm.cmd run test:run -- lib/attendance components/attendance`, TypeScript no-emit checking, and focused ESLint.
- Focused test result: 16 backend tests and 19 web tests passed. Backend tests use pure helpers/mocked queries; web interactions use jsdom, not a real browser.
- Tests cover daily states, overnight/snapshot grouping, multiple punches, void/rejected/pending/exported status, carryover, employment scope, authenticated self scope, missing-profile read safety, bounded query count, custom ranges, CSV escaping, staff drilldown, failure/retry and stale request handling.
- Source audit against [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): labeled controls, visible focus, semantic buttons/tables, status/error messages, dialog scroll containment and bounded table rendering. Real-browser layout, contrast and keyboard checks remain unverified; report filters are not yet persisted in the URL.
- No database migration, production deployment, live database test, real camera/device test or full production build was performed. Deploy matching backend and web versions; old backends do not provide the new register endpoints.
- Validate against the isolated seeded restaurant using **2026-09-22 through 2026-10-19**, then compare one employee across manager report, Staff Attendance, My attendance and CSV. Include overnight and exception cases before rollout.

### Still gated / remaining

Salary formulas, overtime settlement, advances, historical compensation segmentation and monetary statement finalization remain unchanged pending the policy decisions in section 9. Finance, Staff Financials, Flutter parity, full role/database integration tests, legacy roster/overview reconciliation and browser/device QA remain subsequent work. Do not treat this reporting release as proof that payroll is correct.

## 14. Implementation progress — earnings review and salary accounts

The second implementation adds explanations to the existing calculator and connects web Payroll review, Staff Financials and My attendance to the same period earnings view.

### User flow

- **Payroll review** has its own From/To dates, week/month shortcuts, staff search, totals and pagination. A staff name opens the day-by-day calculation: pay rule, units, rate, multiplier, overtime component and earnings. The displayed daily amounts reconcile to the rounded period total.
- **Export earnings CSV** exports the visible earnings estimates and calculation notes for all matching staff. The old approved-attendance export endpoint remains available; the earnings export no longer labels an attendance-minutes file as a salary report.
- **Staff → Financials** shows period earnings above the cumulative salary account. The account labels outstanding salary, earnings estimate, salary paid and deductions, with the equation explaining the balance. Paying salary still pays against the cumulative balance.
- **My attendance** includes a personal period earnings calculation. It has no staff selector, management links or export action. Existing cumulative salary balances remain separately labeled.
- Bulk-payment employee links open Financials. The dialog describes its all-date scope. Finance salary/payroll links open Payroll review.
- Salary loading clears stale balances; failed or stale requests cannot leave another employee's balance available for an action. Payment/deduction forms explain the transaction's scope. Hourly overtime payout shows a specific duplicate-payment warning because the existing salary balance also includes those hours.

### Calculation and endpoint contract

- Existing `/attendance/payroll-preview` results now include daily calculation lines, effective calculation start, daily rate, timezone, as-of time, unresolved completed-entry count, user ID and calculation notes. Existing response fields remain.
- Added `GET /staff/{staff_id}/salary/period?date_from=...&date_to=...` under the existing staff-read access contract and restaurant scope.
- Added `GET /attendance/me/payroll-period?date_from=...&date_to=...` under `attendance.clock`; resolves only authenticated staff and never creates an employment profile.
- Period ranges are limited to 93 inclusive days. Dates can cross Gregorian or BS-month boundaries. Payments/deductions are not subtracted from period earnings because existing transactions are not allocated to a salary period.
- Daily details trace the existing amount accumulator; they do not implement new pay formulas. Cumulative cent rounding makes the displayed lines sum to the period estimate. Invalid/missing amounts or a non-reconciling response become an error, never an assumed zero.
- Calculation notes disclose current-agreement historical recalculation, future dates, unassigned schedules, hourly mode being off and hourly overtime already included. These notes describe existing behavior and do not resolve the policy/correctness findings in section 4.

### Verification and remaining boundary

- Backend: `venv\\Scripts\\python.exe -m unittest discover -s tests/staff -p test_payroll_explanation.py` — 5 tests passed, including scenarios for monthly, weekly, daily and hourly salary. Checks compare traced versus ordinary results and independently expected values, rounding, range/scoping and authenticated self-service. No live database writes or payment posting was performed.
- Web: 32 focused tests passed, covering earnings detail, self-only controls, failure/retry, endpoint scope, CSV formula escaping, Decimal totals and reconciliation; TypeScript and focused ESLint were run.
- Browser: manager calculation dialog and personal layout inspected in a temporary local preview. A subsequent main-workspace verification was blocked by a restaurant-profile load failure. The preview route was removed. Full authenticated integration, real payments and production build/deployment remain unverified.
- Accessibility source review: native labeled dates/search, semantic table/button/link controls, focus indicators, dialog scroll containment, accessible payment form names and explicit loading/error states. Filter URL persistence and full narrow/dark keyboard/contrast checks remain to complete.
- Both backend and web updates are required. No schema migration is required. Existing deployments without calculation details receive an explicit backend-update error.

Historical rate segmentation, payroll permission tightening, overtime settlement reconciliation, salary advances/offsets and immutable monetary statements still need the policy decisions in section 9. Flutter and the remaining profile/workforce summaries remain future refactor work.

## 15. Mobile web implementation

### Employee summary-first follow-up

Detail-view refinement: mobile full attendance history now opens in a separately scrollable phone-height dialog, retaining the selected period and status scope. Closing restores the seven-day preview. Daily earnings calculations and all-date salary account history also open in separate dialogs rather than expanding the profile. Calculations, dates and permission gates are unchanged. Explicit accessible names bypass the shared dialog's generic fallback title. Regression tests cover opening details and restoring the compact preview; authenticated visual verification remains outstanding.

- Employee/self attendance shows seven recent days on mobile with an explicit full-list toggle; desktop retains its register. Rows summarize actual attendance or expected non-working status; full punches, shifts and review detail remain in the existing day dialog.
- Additional period statistics are expandable; outstanding review counts remain visible. The duplicate employee Attendance heading was removed.
- Staff Financials presents the salary account, then selected-period earnings, then an expandable pay agreement. Advances are a separate disclosure. Salary account arithmetic and history are expandable, and daily earnings calculations are collapsed initially.
- Staff editing is secondary on mobile. Existing data endpoints, permissions, pay formulas and settlement semantics are unchanged.
- Follow-up work: consolidate transaction-history filters and relocate discount controls without duplicating their permission/editing flow. Current disclosures preserve these controls rather than removing them.
- Verification: focused regression tests, TypeScript and ESLint. Authenticated phone preview was blocked by restaurant-profile loading and then sign-in; no final visual or dark-mode verification is claimed.

Phone/tablet report layouts below 768px now use compact, full-row attendance and earnings lists; desktop tables remain. Date selection is a compact control opening a sheet with draft dates and explicit Apply dates. Refresh/export move into an actions menu. Daily attendance has previous/next-day controls and tappable working/not-arrived/absent/review counts.

- Attendance and earnings details occupy the phone viewport. Earnings dates expand into formulas; the desktop calculation table is hidden on phones, avoiding nested table scrolling. Report explanations are available through disclosure controls.
- My attendance has Records, Schedule, Pay and Leave navigation on mobile; the current shift stays visible, and the all-date outstanding salary sits within Pay. The desktop page retains its sections. Switching personal sections retains mounted report state.
- Staff Financials puts the salary account before the period report on mobile. Salary and advance/repayment dialogs use a scrollable phone-height layout with larger action targets. Shared metric labels/values wrap rather than truncate.
- Schedule adds a mobile day strip and staff selector. Managers can inspect everyone for a selected date or one employee's complete week, edit through existing controls, and select staff for bulk weekly assignment. The seven-day bulk form is collapsed by default on mobile. Past-date locks and existing save behavior are preserved.
- Mobile timesheets disclose secondary time fields and management actions; visible action targets are at least 44px. Desktop table behavior is unchanged.

Validation: focused report/period interaction tests, TypeScript no-emit and focused ESLint. The mobile date tests verify draft changes do not apply early and invalid ranges are blocked. At 390px, browser accessibility inspection with isolated sample data verified date-sheet opening/apply, compact staff rows, earnings detail and expandable days. Screenshot capture timed out and the authenticated workspace failed its restaurant-profile load, so full visual, dark-theme, keyboard and authenticated scheduling/payment checks remain unverified. The temporary sample route and its generated type file were removed. No backend or pay-policy changes were made for this mobile pass.

Detail dialogs retain local list/filter state when closed. Report filters are still not serialized into the URL; navigating away and returning through a fresh page load does not yet restore them. This remains a navigation hardening task.
