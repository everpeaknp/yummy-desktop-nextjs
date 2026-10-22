# Day Close: Product, Domain, Accounting, and UX Audit

Status: audit only. No Day Close, drawer, finance, accounting, or fiscal behavior was changed.

Audit date: 24 September 2026

Repositories inspected:

- Next.js: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`
- FastAPI: `C:\yummy_backend`
- Flutter: `C:\flutter applications\yummy`

## 1. Executive summary

Day Close is not currently a simple “finish today” action. It is a coordinated operational control that:

1. chooses an exact timestamp window;
2. validates orders, refunds, payments, and drawer readiness;
3. freezes a detailed operational snapshot;
4. records the authoritative counted cash from approved drawer evidence;
5. for restaurant closes, posts missing accounting events, records the cash variance event, and refuses to close when the accounting daybook contains blocking exceptions;
6. links covered drawer sessions to the close and preserves audit history.

The system therefore implements both operational confirmation and accounting work. The accounting work is necessary, but its implementation detail currently dominates the normal-user experience.

### Principal verified findings

- The active close window is **not** the configured `business_day_start_time` range. The selected close date is an accounting label. The actual window runs from the previous confirmed close’s end (or, for the first close, local midnight/earliest unlinked drawer opening) to the confirmation time.
- Controller defaults still use the older configured-business-day helper. This creates a semantic mismatch between the default date label and the exact-window resolver.
- Skipping days creates one longer exact window from the last confirmed close to the new close time; it does not create one close per skipped calendar day.
- Drawer controls are optional at restaurant level. When enabled, each active drawer configuration needs auditable settled evidence. Day Close does not silently close or settle drawers.
- The payment check blocks overpayment but deliberately permits underpaid completed orders. Underpaid or credit settlement is therefore not automatically a blocker.
- Pending negative refund payments block. KOT state, attendance, printer state, receipt state, and fiscal/CBMS submission state are not Day Close blockers in the inspected code.
- Restaurant confirmation is both operational and accounting-aware: existing transaction events normally precede close, but confirmation also posts missing events and records cash variance accounting.
- Accounting daybook blockers are unposted posting-required events, suspense postings, and debit/credit imbalance. Missing payment-instrument attribution is a non-blocking warning.
- The ordinary Day Close permission sets are overly broad: view permissions are accepted for initiate, confirm, cancel, audit, and export. Reopen and financial adjustments are more restricted.
- There is no explicit idempotency key and no observed row lock around Day Close confirmation. Unique date/scope constraints help prevent duplicate records, but do not fully protect double-confirm races or retry-after-timeout semantics.
- The current reopen implementation contains a verified defect: `reopen_day()` calculates `scope` but passes the undefined name `drawer_scope` to `get_latest_confirmed_close()`. Reopen is therefore expected to fail before its intended latest-close check in this code state.
- Confirmed snapshots are frozen. Historical corrections are represented through adjustments or a latest-close reopen flow, but Day Close itself does not globally make every underlying order/payment/expense row immutable.
- The Next.js close flow asks the user to understand drawers, daybook, accounting exceptions, snapshots, finance totals, and close state across a large modal. This is substantially more complexity than the closing-time job requires.

### Recommended product direction

Retain the verified controls but reorganize them into three concepts:

1. **Review** — show readiness, sales, payment match, and cash status.
2. **Resolve and confirm** — expose only blockers and drawer actions that require intervention.
3. **Close** — show a short, accurate consequence statement, optional note, cash difference, and one final action.

Accounting evidence remains accessible after close and to authorized finance users, but journal mechanics must not dominate the normal flow.

## 2. Current user flow

### Next.js operational flow

1. The user reaches `/day-close` from Manage/Finance, Dashboard status, Finance Overview, or Hotel (`?business_line=hotel`).
2. The page loads the current close and a live snapshot for the selected close-date label and business line.
3. The user sees status, exact covered range, net sales, expenses, History, and “What This Does.”
4. The user selects Restaurant, Hotel, or Combined scope when allowed and starts/continues the close.
5. The Day Close dialog opens on **Cash drawers**.
6. The dialog loads readiness. If drawer controls are enabled, the embedded drawer workspace may require opening, counting, recounting, variance approval, settlement allocation, correction, or reopening.
7. The user selects **Review daybook** only when the backend readiness response has no blockers.
8. The client loads a fresh Day Close snapshot and, for restaurant scope, the accounting daybook.
9. The user reviews a detailed accounting daybook plus a large Day Close snapshot. Blocking accounting exceptions disable final confirmation.
10. The user optionally enters confirmation notes and selects **Confirm final close**.
11. The client first calls `POST /day-closes/initiate`, loads another snapshot, derives `actual_cash` from drawer-control counted cash (or expected cash when drawer evidence is absent), then calls `POST /day-closes/{id}/confirm`.
12. The server revalidates against a final timestamp, regenerates the snapshot, runs accounting work, commits, and queues the report email.
13. The success step shows operational-close status. History provides later detail, export, adjustment, cancel, reopen, and re-confirm actions.

### Flutter operational flow

Flutter exposes `/day-close` as `DayCloseScreen` and follows the same API contract with a separate native implementation:

1. **Cash drawers** (`HealthCheckStep`)
2. **Daybook & snapshot** (`FinancialSnapshotStep`)
3. **Complete** (`SuccessStep`)

`DayCloseBloc` validates, initiates, fetches the snapshot, confirms, cancels, and exports. Flutter also has separate history and detail screens, adjustment/reopen controls, audit display, export, and thermal report printing. The screen is not merely a WebView of the Next.js UI.

### Concepts currently required of an ordinary user

The current interface asks users to distinguish: close date, exact covered window, business line, cash-control mode, drawer configuration, drawer session, opening count, closing count, retained float, settlement destination, variance approval, daybook, accounting exception, snapshot, operational close, accounting review, and historical adjustment. These concepts are valid in the domain, but too many are present at the primary decision level.

## 3. Route and component inventory

### Next.js routes

| Route                            | Purpose and entry points                                                                                          | Primary implementation                                                                                                                            | APIs and actions                                                                                                                       | States                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/day-close`                     | Canonical operational close, linked from Dashboard, Manage/Finance, Finance Overview, mobile dashboard, and Hotel | `app/(dashboard)/day-close/page.tsx`, `DayCloseModal`, `DayCloseHistory`, `DayCloseSnapshotPanel`, `DrawerSessionPanel`, `OperationalCloseStatus` | current, validate, preview snapshot, initiate, confirm, list/detail/history, audit, adjustments, cancel/reopen, PDF/Excel; drawer APIs | Page error alert, loading controls, current/snapshot absence, modal error, history skeleton/empty state |
| `/cash-drawers`                  | Operational drawer configuration/session counting and settlement; also reachable from Day Close drawer actions    | `app/(dashboard)/cash-drawers/page.tsx`, `DrawerSessionPanel`, count and settlement dialogs                                                       | drawer configuration/readiness/session/movement/count/approve/settle/reopen/correct                                                    | Loading, backend error toasts, missing configuration, no sessions, opening-policy unavailable           |
| `/finance/accounting/day-closes` | Finance/accounting review of confirmed operational closes                                                         | `DayCloseReviewClient`, accounting navigation                                                                                                     | list/detail, posting status, review, evaluate, evidence, journal trace, post missing events, approve, soft-close                       | Permission message, load errors, no confirmed closes, no selection                                      |
| `/dashboard`                     | Status/shortcut entry                                                                                             | dashboard status card/action                                                                                                                      | dashboard response supplies status/action/route                                                                                        | Dashboard-owned states                                                                                  |
| `/finance`                       | Finance workspace entry                                                                                           | finance workspace metadata/cards                                                                                                                  | navigation only                                                                                                                        | Finance workspace states                                                                                |
| `/hotel`                         | Hotel daybook entry                                                                                               | hotel page button                                                                                                                                 | navigates to `/day-close?business_line=hotel`                                                                                          | Hotel workspace states                                                                                  |
| `/analytics`                     | Legacy/secondary Day Close access and close-session filtering for analytics                                       | analytics page and shared `DayCloseModal`                                                                                                         | close APIs plus session list                                                                                                           | Analytics-owned states                                                                                  |

`/day-close` is protected by the `finance.daybook.enabled` entitlement layout. Route metadata marks it as a secondary mobile module whose default back target is `/manage`. Frontend route permission metadata maps it to `reports.daily.view`, while backend permission behavior is described in section 15.

### Next.js navigation entries

- Dashboard Day Close status/action.
- Mobile Dashboard route mapping.
- Finance Overview/workspace “Day close.”
- Finance home.
- Hotel “Open hotel daybook.”
- Manage/desktop sidebar Finance grouping.
- Global search/role permission route catalog.
- Accounting navigation “Day Closes” (accounting review, not the operational close).

### Flutter routes and components

| Surface              | Purpose                                                                      | Main files                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/day-close`         | Native operational close                                                     | `lib/core/routes/app_router.dart`, `day_close_scope_gate.dart`, `day_close_screen.dart`                           |
| Readiness            | Drawer/order/refund readiness                                                | `health_check_step.dart`                                                                                          |
| Snapshot and daybook | Financial/accounting review and confirm                                      | `financial_snapshot_step.dart`, `accounting_daybook_report.dart`, `hotel_daybook_tabs.dart`                       |
| Completion           | Result/export navigation                                                     | `success_step.dart`                                                                                               |
| History              | Filtered close register                                                      | `day_close_history_screen.dart`, history BLoC/filter sheet                                                        |
| Detail               | Snapshot, payments, drawers, audit, adjustments, reopen/export/thermal print | `day_close_detail_screen.dart`, `day_close_detail_cubit.dart`, `day_close_thermal_print_service.dart`             |
| Data contract        | HTTP repository/models                                                       | `day_close_repository_impl.dart`, `day_close_repository.dart`, `day_close_models.dart`, `core/api/endpoints.dart` |

### Backend operational endpoints

All paths are under `/day-closes` and the paid `day_close` feature dependency.

| Method/path                             | Purpose                                                 | Permission family               |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `GET /current`                          | Current close/status for date/scope                     | view                            |
| `GET /`                                 | History                                                 | view                            |
| `GET /sessions`                         | Lightweight confirmed windows for filters               | view                            |
| `GET /generate-snapshot`                | Live preview for exact window                           | view                            |
| `GET /validate-close`                   | Readiness/blockers                                      | view                            |
| `POST /initiate`                        | Create/resume pending close                             | initiate plus view aliases      |
| `POST /{id}/confirm`                    | Final revalidation, snapshot, accounting bridge, commit | confirm plus view aliases       |
| `POST /{id}/cancel`                     | Pending to open                                         | cancel plus view aliases        |
| `POST /{id}/adjust-cash-reconciliation` | Retired endpoint; always `410 Gone`                     | authenticated                   |
| `POST /{id}/reopen`                     | Reopen latest confirmed close                           | reopen/admin settings           |
| `POST /{id}/adjustments/expense`        | Post-close expense correction                           | financial-adjust/admin settings |
| `POST /{id}/adjustments/income`         | Post-close income correction                            | financial-adjust/admin settings |
| `GET /{id}/adjustments`                 | Adjustment history                                      | audit/view aliases              |
| `GET /{id}/audit-log`                   | Audit history                                           | audit/view aliases              |
| `GET /{id}/export/pdf`                  | Frozen report export                                    | export/view aliases             |
| `GET /{id}/export/excel`                | Frozen report export                                    | export/view aliases             |
| `GET /{id}`                             | Detail                                                  | view                            |
| `GET /{id}/snapshot`                    | Saved frozen snapshot                                   | view                            |

Accounting review endpoints under `/accounting/day-closes` require the accounting feature and `finance.accounting.view`; approval/soft-close require `finance.accounting.periods.close`, and posting missing events requires `finance.ledger.backfill`.

## 4. Backend and domain architecture

### Principal files

- Controller: `app/controller/day_close_controller.py`
- Service: `app/services/day_close_service.py`
- Repository: `app/repositories/day_close_repository.py`
- Model: `app/models/business_day_close_model.py`
- Schemas: `app/schema/day_close_schema.py`
- Legacy date helpers: `app/utils/day_close_utils.py`
- Accounting bridge: `app/services/day_close_accounting_bridge_service.py`
- Accounting review: `app/services/day_close_accounting_review_service.py`
- Daybook: `app/services/accounting_daybook_service.py`
- Accounting controller: `app/controller/accounting_controller.py`
- Drawer model/service/repository: `drawer_session_model.py`, `drawer_session_service.py`, `drawer_session_repository.py`
- Period lock guard: `app/utils/accounting_lock_guard.py`

### Preview call graph

```text
Next.js/Flutter
  -> GET validate-close or generate-snapshot
  -> day_close_controller resolves restaurant/date and access
  -> DayCloseService resolves exact start/end timestamps
  -> drawer readiness + order/payment/refund validation
  -> snapshot queries operational and finance sources
  -> response (no close mutation)
```

### Final confirmation call graph

```text
Client POST /day-closes/initiate
  -> access, entitlement, scope-policy checks
  -> DayCloseService.initiate_close
  -> create/resume pending BusinessDayClose + audit
  -> commit

Client POST /day-closes/{id}/confirm
  -> tenant/record access
  -> DayCloseService.confirm_close
  -> resolve final exact window ending at confirmation time
  -> validate drawers, active orders, overpayments, pending refunds
  -> regenerate full snapshot
  -> verify submitted cash against authoritative drawer counts
  -> for restaurant: accounting preflight
       -> record cash variance finance event
       -> post missing posting-required finance events
       -> regenerate daybook
       -> reject blocking exceptions
       -> freeze daybook + upsert accounting review
  -> for hotel/combined: write operational bridge status without general-ledger bridge
  -> mark close confirmed, save snapshot, link drawer sessions, audit
  -> single DB commit
  -> queue admin report email after response transaction succeeds
```

The email is an asynchronous background action and is outside the database transaction. Email failure does not roll back a completed close.

## 5. Business-day semantics

### Timezone source

The restaurant’s `timezone` is authoritative for local date conversion. UTC-aware timestamps are stored/compared. `pytz` localization is used for local midnight and legacy configured-start calculations, so timezone transitions are delegated to the timezone database.

### Two competing rules exist

**Legacy helper rule:** `get_business_date()` and `get_business_day_range()` respect `restaurant.business_day_start_time`. For a 04:00 start, a legacy 3 September day is 3 September 04:00 through just before 4 September 04:00.

**Active exact-close rule:** `_resolve_exact_close_window()` explicitly says the selected date is an accounting label, not a configured business-day bucket.

- End: supplied end or current UTC time.
- Start after an existing close: previous confirmed close’s `period_end_at`, falling back to `confirmed_at`.
- First close: selected date’s local midnight, or an earlier unlinked drawer opening if one exists.
- Future label: rejected.
- End at/before start: rejected as an empty period.
- Query windows generally use half-open terminal ranges (`>= start`, `< end`), although several blocker/refund/expense queries use `> start`, `<= end`. This boundary inconsistency should be normalized in a domain-hardening stage.

The controller’s default-date resolver still calls `get_business_date()`. Consequently, before a configured 04:00 start it may default the label to the previous date, while the actual service window still follows previous-close/local-midnight continuity. The configured start time must not be described to users as the current close boundary.

### Overnight, late, skipped, and changed settings

- Overnight service is covered by the continuous exact timestamp window, not by the configured start/end definition.
- Closing late simply extends the current open window to the actual confirmation time.
- Skipping days produces one longer close window from the previous confirmed end to the new confirmation. There is no automatic record for each skipped calendar date.
- Changing business-day start settings does not reframe saved confirmed windows. Saved `period_start_at` and `period_end_at` remain the historical authority.
- The unique record identity is restaurant + business line + date label. The exact window is separately stored.
- A date/scope already confirmed is not initiated as a second independent close; history opens the confirmed record. A reopened record is re-confirmed using the same ID.

## 6. Data model

### `BusinessDayClose`

| Field group           | Stored meaning                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Identity              | `id`, `restaurant_id`, `business_date` label, `business_line`                                                                           |
| Exact coverage        | nullable `period_start_at`, `period_end_at`; these are the authoritative inclusion boundary when present                                |
| State                 | `open`, `pending`, `confirmed`, `reopened`                                                                                              |
| Orders                | total/completed/canceled counts                                                                                                         |
| Sales                 | gross, discount, tax, service charge, net                                                                                               |
| Collections           | opening balance; cash/card/digital/FonePay/credit sales; credit collections; manual cash income; receivables                            |
| Expenses/refunds      | counts and totals                                                                                                                       |
| Cash result           | expected, actual, discrepancy, net cash position                                                                                        |
| Initiation            | user and timestamp                                                                                                                      |
| Confirmation          | user, timestamp, notes                                                                                                                  |
| Reopen                | count, user, timestamp, reason                                                                                                          |
| Legacy variance links | discrepancy expense/income IDs; current code treats drawer variance as an accounting variance event rather than a normal expense/income |
| Audit timestamps      | created/updated                                                                                                                         |

Related records:

- one `DayCloseSnapshot` containing JSON evidence;
- many audit logs;
- many financial adjustments;
- linked drawer sessions;
- one persistent accounting review.

The snapshot is broader than the top-level summary. It contains period metadata, orders/menu/table detail, payment instruments, refunds, expenses, purchases, manual income, receivables, drawer evidence, cash-control policy, finance summary/compatibility values, hotel detail where applicable, daybook, and accounting-bridge status.

### Historical compatibility

The snapshot service is transitional. It can preserve legacy order/expense values when the reporting ledger is incomplete, while overlaying authoritative Finance Core values when `ledger_complete` allows it. The top-level close columns mirror important values for compatibility; the frozen canonical snapshot is the richer source for history/reporting.

## 7. Cash and drawer reconciliation

### Is a drawer required?

Not always. Cash-control settings can disable drawer enforcement. When disabled, cash payments can exist without a session and Day Close uses its fallback cash calculation. When enabled, active drawer configurations require evidence.

### Supported topology

- Multiple configurations and drawers per business line.
- Cashier assignments and access rules.
- Multiple sequential sessions for the same drawer during one close window.
- Separate Restaurant/Hotel cash control or a shared Combined policy.
- Independent open, count, variance review, settlement, correction, and reopen lifecycle.

### Authoritative formula

For a drawer session:

```text
expected closing cash
= counted opening cash
+ sum of signed drawer movements
```

The movement breakdown includes:

- inflows: cash sales, manual cash income, receivable collections, transfers in, positive adjustments;
- outflows: cash refunds, expenses/payouts, inventory payments, supplier payments, payroll/tax payments, cash drops, transfers out, negative adjustments.

The service exposes the same components as a breakdown. For sequential sessions, exact-window aggregation avoids counting retained opening cash and the same movements twice. A count after the close cutoff can be converted into inferred boundary evidence. Non-retain settlement resets the effective opening for the next session.

When drawer controls are disabled, fallback Day Close expected cash is:

```text
opening balance
+ cash sales
- cash refunds
+ cash credit collections
+ manual cash income
- cash expenses
```

### Count and settlement rules

- Counts may be blind depending on configuration.
- Counted closing cash minus expected cash is variance.
- A variance outside tolerance requires reason/approval.
- Counted cash must be fully allocated between retained float and settlement transfer(s).
- A settlement can target safe/bank/custody accounts and can be split.
- Day Close requires the relevant sessions to be approved/settled; it does not perform these decisions automatically.
- The submitted Day Close `actual_cash` must match summed authoritative drawer counts within NPR 0.01.
- Cash activity after a completed count can force a recount.
- Closing links covered sessions to the Day Close.

## 8. Payments

| Method/category   | System expected                                                                                     | User enters actual?                                                                      | Variance allowed at Day Close?                       | Blocking rule                                                         | Accounting consequence                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Cash              | Positive successful cash collections less cash outflows/refunds through drawer/fallback calculation | Through physical drawer counts, not a separate Day Close field when controls are enabled | Yes; becomes cash variance after approval/settlement | Unsettled/incomplete drawer evidence blocks                           | Cash variance finance event/journal; drawer settlements move custody |
| Card              | Successful payment totals and instrument breakdown                                                  | No Day Close count                                                                       | No manual Day Close variance field                   | Missing instrument is daybook warning, not blocker                    | Existing payment/clearing event is posted; settlement is separate    |
| Digital/QR        | Successful totals and instrument breakdown                                                          | No                                                                                       | No                                                   | Missing instrument is warning                                         | Existing instrument/clearing event                                   |
| FonePay           | Successful totals                                                                                   | No                                                                                       | No                                                   | Same non-cash instrument warning behavior where attribution is absent | Existing event/clearing path                                         |
| Bank/external     | Represented through configured payment instruments/events where supported                           | No close-time count                                                                      | No                                                   | No dedicated close blocker found                                      | Existing event/account mapping                                       |
| Split             | Each successful payment contributes to its own method/instrument                                    | No extra confirmation                                                                    | No                                                   | Same per-order overpayment check                                      | Existing events per payment                                          |
| Customer credit   | Credit sale and receivable values are reported                                                      | No                                                                                       | Balance may remain                                   | Underpayment/credit is allowed; it is not a blocker                   | Receivable/credit posting already exists or is posted from event     |
| Credit collection | Included in collection and cash movement if cash                                                    | Drawer count for cash only                                                               | Cash variance possible                               | Drawer readiness applies                                              | Receivable collection event and custody movement                     |
| Supplier payment  | Not a sale payment; cash movement may reduce drawer expected cash                                   | Reflected in drawer count                                                                | Cash variance possible                               | Drawer readiness, not a separate Day Close blocker                    | Existing supplier/cash accounting                                    |

Payment reconciliation iterates completed orders in the exact terminal window. It blocks only when successful payments exceed `grand_total`. Its code comment says this permits refunds; practically, it also allows zero/partial payment and credit balances.

## 9. Sales totals

- Completed and canceled orders are selected using a terminal timestamp expression: completed, canceled, updated, then created timestamp.
- Gross sales is completed-order subtotal.
- Discounts, tax, service charge, and net sales are summed from completed-order fields.
- Refund payment events are time-scoped separately and reduce reported net effects.
- Complimentary/void/canceled behavior follows order totals/status and existing finance events; canceled orders are counted but not treated as completed sales.
- Payment totals come from successful payments, grouped by method and, for card/digital, instrument.
- Credit sales and receivables are separately exposed.

This is not a single source in every deployment state. The snapshot reconciles operational order models with Finance Core reporting and legacy expense sources. Tests explicitly cover ledger-complete and ledger-incomplete fallback behavior. The client should not recompute these totals.

## 10. Expenses and cash movements

| Activity                          | Affects expected cash?                                        | Appears in close?                                                                     | Separate accounting event?                     | Enterable during Day Close?                              |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Manual cash expense/payout        | Yes, negative                                                 | Expense/cash breakdown                                                                | Yes                                            | Not in primary close; post-close adjustment is available |
| Non-cash expense                  | No physical cash effect                                       | Expense/profit summary                                                                | Yes                                            | Post-close expense adjustment supported                  |
| Manual cash income                | Yes, positive                                                 | Income/cash breakdown                                                                 | Yes                                            | Post-close income adjustment supported                   |
| Supplier/inventory payment        | Yes when sourced from drawer                                  | Drawer movements/cash evidence; inventory purchase is not automatically a P&L expense | Yes                                            | Not created by the close flow                            |
| Staff advance/payroll/tax payment | Yes when recorded as drawer outflow                           | Drawer movement evidence                                                              | Existing domain accounting                     | Not created by the close flow                            |
| Transfer/cash drop                | Yes for source drawer; custody transfer is not income/expense | Drawer settlement/activity                                                            | Settlement journal/finance event where enabled | Performed in drawer workflow                             |
| Settlement/deposit                | Allocates counted cash; does not invent revenue               | Drawer evidence                                                                       | Custody transfer accounting                    | Performed before close                                   |
| Post-close adjustment             | Snapshot and variance resynchronized according to method/type | Adjustment history                                                                    | Creates real Expense/Income + finance event    | Yes, from history/detail, with permission                |

“Expenses without documentation” is currently a placeholder warning function that always returns zero. The UI must not imply this is an implemented receipt-completeness control.

## 11. Accounting behavior

Day Close is option **C: both confirms existing postings and creates/completes accounting work**.

- Sales, payments, refunds, expenses, and many cash movements create finance events in their originating workflows.
- Restaurant close preflights the exact-window daybook.
- It records an idempotently keyed cash-variance event when actual differs from expected.
- It posts missing posting-required finance events to journals.
- It regenerates the daybook and blocks if posting-required events remain unposted, finance journals use suspense mappings, or debits and credits differ.
- It freezes daybook evidence and creates/updates the accounting-review record.
- Cash short/over is posted to the configured cash/cash-over-short mapping through the finance posting layer.
- Hotel and Combined closes record an operational bridge state and intentionally do not require the optional general-ledger bridge.

Day Close does not independently repost every sale, tax, revenue, or clearing amount when it already has valid event/journal evidence. It fills missing journal postings and records the close-specific variance.

Reports can already contain operational/finance events before close. Confirmed close and accounting review determine finality/evidence and are prerequisites for stricter period-lock workflows; Day Close is not the only source from which report values exist.

## 12. Closing blockers

| Condition                                                    | Classification                                | Current rule/source                                        |
| ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| Active order created within close window                     | **Blocking**                                  | `validate_can_close()`; status not completed/canceled      |
| Completed order successful payments exceed total             | **Blocking**                                  | payment reconciliation                                     |
| Underpaid/partially paid/credit order                        | **Not blocking**                              | reconciliation explicitly permits paid <= total            |
| Pending negative refund payment in window                    | **Blocking**                                  | pending refund count                                       |
| Drawer controls enabled but no active configuration          | **Blocking**                                  | drawer readiness/evidence                                  |
| Required drawer not opened and no eligible retained evidence | **Blocking**                                  | drawer readiness                                           |
| Drawer not counted/recounted/settled/approved                | **Blocking**                                  | drawer status/evidence                                     |
| Cash activity after count                                    | **Blocking** until recount                    | confirmation drawer evidence                               |
| Submitted actual cash differs from drawer counts             | **Blocking**                                  | NPR 0.01 comparison                                        |
| Unposted posting-required finance events                     | **Blocking** for restaurant accounting bridge | daybook exception                                          |
| Suspense journal mapping                                     | **Blocking**                                  | daybook exception                                          |
| Daybook debit/credit difference                              | **Blocking**                                  | daybook exception                                          |
| Missing card/digital instrument                              | **Warning**                                   | non-blocking daybook exception                             |
| Expense missing documentation                                | **No effective rule**                         | placeholder always returns zero                            |
| Open/pending KOT                                             | **Not relevant to current close validation**  | no Day Close rule found                                    |
| Attendance/shift roster                                      | **Not relevant**                              | no Day Close rule found                                    |
| Printer/receipt availability                                 | **Not relevant**                              | no Day Close rule found                                    |
| Pending/failed fiscal or CBMS submission                     | **Not relevant to Day Close validation**      | no Day Close fiscal dependency found                       |
| Pending transfer not represented as drawer status            | **No separate rule**                          | only its resulting drawer/session/accounting state applies |
| Future close-date label                                      | **Blocking**                                  | exact-window resolver                                      |
| Empty/reversed close window                                  | **Blocking**                                  | exact-window resolver                                      |
| Scope conflicts with combined/separate cash policy           | **Blocking**                                  | cash-control policy guard                                  |

## 13. Lock, reopen, and correction behavior

### What is frozen

- The confirmed close record, exact period, top-level totals, saved JSON snapshot, audit records, linked drawer evidence, and accounting-review evidence.
- The latest approved drawer sessions linked to the close remain settled unless an authorized reopen/correction path changes them.
- Downstream weekly/monthly operational/accounting periods can depend on the confirmed close.

### What Day Close does not globally lock

No Day Close code was found that universally makes every covered order, payment, refund, expense, receipt, or fiscal document immutable. Other domain and accounting-period guards may independently reject historical mutations. Therefore “locks all daily transactions” is too broad for current UI copy.

### Reopen intent

- Confirmed only.
- Only the latest confirmed close in the business line.
- Requires `reports.dayclose.reopen` or `admin.settings.manage`.
- Requires a 5–500 character reason.
- Clears confirmation/cash-result fields, reverses current variance accounting, reopens linked drawer sessions/reverses settlements where permitted, invalidates dependent periods, and audits the action.
- The same Day Close ID is then re-confirmed.

### Verified reopen defect

`DayCloseService.reopen_day()` defines `scope` but calls `get_latest_confirmed_close(... business_line=drawer_scope)`. `drawer_scope` is undefined in that function. This is a functional defect, not a UX issue, and should be fixed/tested before any redesigned UI promises reopen reliability.

### Corrections without reopen

Authorized users can add income or expense adjustments to a confirmed close. These create actual domain records and finance events, resynchronize the snapshot/cash result, preserve audit history, and invalidate dependent confirmed weekly/monthly periods. Older confirmed days are intended to use adjustment rather than reopen.

Cancel is only a pending-close reset to open. Although a cancel-request schema exists, the controller accepts no cancel body, so the client-provided reason is not persisted by the current endpoint.

## 14. Fiscal interaction

No direct Day Close validation or confirmation dependency was found for VAT invoice issuance, IRD/CBMS submission, fiscal numbering, printer output, receipt state, credit-note fiscal state, or failed fiscal submission.

Fiscal sales/refunds can influence existing orders, payments, refund events, tax totals, and accounting events, but fiscal submission itself is not a Day Close blocker. The redesigned UI must not claim that closing submits CBMS, finalizes fiscal numbering, or verifies all fiscal documents unless a new verified rule is intentionally added later.

## 15. Permissions

### Backend operational permissions

| Capability                         | Accepted permissions                                           |
| ---------------------------------- | -------------------------------------------------------------- |
| View/status/preview/history/detail | `reports.dayclose.view` or `reports.daily.view`                |
| Initiate                           | `reports.dayclose.initiate` **or either view permission**      |
| Confirm                            | `reports.dayclose.confirm` **or either view permission**       |
| Cancel                             | `reports.dayclose.cancel` **or either view permission**        |
| Audit                              | `reports.dayclose.audit.view` **or either view permission**    |
| Export                             | day-close/report export **or either view permission**          |
| Reopen                             | `reports.dayclose.reopen` or `admin.settings.manage`           |
| Financial adjustment               | `reports.dayclose.adjust.financial` or `admin.settings.manage` |

The inclusion of view permissions in mutation permission lists weakens separation of duties. This must be decided as a domain/authorization correction before the UI is simplified. Hiding buttons alone would not secure the operations.

Drawer actions have their own granular permissions for own/any drawer, counting, variance approval, settlement/transfer, correction, and reopen. Accounting review uses separate finance permissions.

### Recommended role disclosure

- Cashier: own drawer actions and readiness relevant to their drawer; no accounting detail.
- Closing manager: all close blockers, all required drawer coordination, final close if explicitly permitted.
- Finance/accountant: accounting review, evidence, journal trace, post-missing-events/period controls according to permission.
- Administrator: exceptional reopen/correction/configuration.

## 16. Error, idempotency, and concurrency behavior

### Transaction and retry boundaries

- Initiate commits a pending record separately from final confirmation.
- Final confirmation performs validation, snapshot, drawer linking, bridge work, audit, and the final state commit in one database session/commit.
- Accounting bridge writes are therefore intended to roll back with a failed DB transaction before commit.
- The report email is queued after confirmation and is not atomic with the database commit.
- There is no request idempotency key on initiate/confirm.
- The unique restaurant/scope/date-label constraint helps stop duplicate close records.
- A retry after a successful server commit but client timeout can receive “cannot confirm confirmed” rather than a replayed success response.
- No Day Close record `SELECT ... FOR UPDATE` was observed during confirmation. Two managers can race; both revalidate, and database/state checks are the remaining protection. Drawer actions themselves use row locks.
- The final timestamp is captured and validation is rerun. New activity after that timestamp belongs to the next window, but concurrent activity around the validation/commit boundary is not prevented by an explicit restaurant-wide close lock.

### Current error/warning audit

| Current/system message                                | Actual meaning                                     | Required action                                | Proposed plain-language message                                                        |
| ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| “Resolve every blocker before reviewing the daybook.” | operational readiness failed                       | inspect blocker list                           | “Fix the items below before continuing.”                                               |
| “Day close is blocked by incomplete drawer controls.” | one or more required drawers lack settled evidence | open/count/recount/settle named drawers        | “Finish these cash drawers before closing.”                                            |
| “Finance events need posted journals”                 | accounting event lacks required journal            | finance user repairs/posts                     | Hide from normal user: “Accounting review is required.” Detail for finance only.       |
| “Finance-event journals are posted to suspense”       | account mapping unresolved                         | finance setup/correction                       | “Accounting setup is incomplete.” Show suspense detail only to finance.                |
| “Journal debit and credit totals differ”              | accounting integrity failure                       | finance investigation                          | “Accounting totals do not balance. Ask an authorized finance user to review.”          |
| “Card/digital payment is missing payment instrument”  | collection lacks instrument attribution            | optional review/correction                     | “A card or QR payment is missing its provider.” Warning, not blocker.                  |
| “The selected close date cannot be in the future.”    | invalid label                                      | choose today/past                              | Keep, with date shown.                                                                 |
| “No open close period exists...”                      | resolved end is not after prior close              | refresh/select valid date                      | “There is no unclosed activity before this time.”                                      |
| “Cannot reopen older confirmed days...”               | latest-close-only policy                           | use adjustment                                 | “Only the latest close can be reopened. Add a dated correction to this close instead.” |
| Generic “Failed to load...” toast                     | full section unavailable                           | retry, do not interpret missing values as zero | Use section ErrorState with Retry and retain last known values if safe.                |
| “Opening policy is loading or unavailable”            | suggestion could not load                          | retry or authorized manual path                | Preserve unavailable state; never show NPR 0 as inferred opening cash.                 |

The UI already uses skeletons for history/detail and explicit error text/toasts in the modal. However, several nested drawer failures are toast-only, and a partially loaded large modal can be difficult to interpret. Unknown/unavailable values must remain visibly unknown, never defaulted to zero for presentation.

## 17. Current UI information architecture and problems

### Mobile

Current hierarchy:

- secondary app bar supplied by the shell;
- date/scope controls;
- summary surface with status/range/net sales/expenses;
- History/What This Does tabs;
- a large full-height close dialog with a three-step indicator;
- Step 1 embeds the complete drawer operations workspace;
- Step 2 embeds a full accounting daybook and full snapshot;
- Step 3 completion;
- history detail contains snapshot/audit/adjustments and nested action dialogs.

Problems:

- The default experience is a control center, not a guided closing task.
- The close date is visually primary even though it is only a label and can be semantically misleading.
- Drawer administration, shift settlement, and Day Close are composed into one long surface.
- Accounting daybook terminology appears before users know whether any action is needed.
- Summary values repeat across page, modal, daybook, snapshot, and history.
- Nested cards and nested dialogs consume mobile height and obscure progression.
- The user must inspect many ordinary totals before seeing the small set of actual blockers.
- “Locks in your daily totals” overstates the global mutation lock.
- The final action mutates immediately without a distinct concise confirmation explaining exact consequences.

### Desktop

Desktop adds width but keeps the same mental model: page summary, tabs, then a modal with drawer workspace and large vertically stacked reports. The modal can be maximized, but width is not used to keep required decisions in one primary column with supporting context beside them. History/detail is powerful but mixes operational review, accounting evidence, exports, corrections, and audit in one dialog.

### What is good and should be retained

- Backend-authoritative exact period is shown.
- Drawer evidence is not client-recalculated.
- Blockers are distinguished from readiness.
- Saved snapshot/history/audit remain available.
- Reopened state is explicit.
- Business-line policies are represented.
- Loading skeletons and empty history state exist.
- Finance accounting review is already a separate route and can remain the advanced workspace.

## 18. Terminology audit

| Current term                                 | Classification                  | Recommended wording/use                                                                   |
| -------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| Day Close                                    | User-friendly in POS context    | Keep; subtitle “Review and finish this business period.”                                  |
| Close date                                   | Needs clarification             | “Business date label”; normally display date without asking users to interpret boundaries |
| Covered period / exact window                | Manager detail                  | “Activity included: [start]–[end]”                                                        |
| Expected cash                                | Needs plain language            | “Cash the system expects”                                                                 |
| Actual cash                                  | Ambiguous with drawer authority | “Cash counted”                                                                            |
| Cash discrepancy / reconciliation variance   | Needs plain language            | “Cash difference” with Over/Short label                                                   |
| Net sales                                    | Acceptable with explanation     | “Sales after discounts and returns” in detail                                             |
| Tender                                       | Avoid                           | “Payment method”                                                                          |
| Settlement                                   | Needs context                   | “Where the counted cash goes” in drawer workflow                                          |
| Drawer                                       | User-friendly                   | “Cash drawer”; preserve configuration name                                                |
| Daybook                                      | Specialist/manager term         | Hide by default; “Daily accounting check” where needed                                    |
| Snapshot                                     | Technical                       | “Close summary”                                                                           |
| Posting / finance event / journal / clearing | Hide from normal user           | Finance/accounting detail only                                                            |
| Trial balance                                | Accounting detail               | Finance-only                                                                              |
| Suspense                                     | Accounting detail               | Finance-only with actionable mapping message                                              |
| Reopen                                       | Manager/admin term              | Keep with explicit consequence and reason                                                 |
| Adjustment                                   | Precise but explain             | “Add a dated correction”                                                                  |
| Retained float                               | Manager detail                  | “Cash kept in drawer for next opening”                                                    |
| Combined close                               | Needs explanation               | “Restaurant + hotel close” where policy uses shared cash                                  |

## 19. History and completion ownership

### Completion state should contain

- business date label and exact covered range;
- final sales and collected payments;
- counted cash and cash difference;
- close status;
- closed by/at;
- any non-blocking warnings retained for later review;
- actions: View close details, Return to dashboard.

### History register should contain

- date/range, business line, status;
- sales, counted cash difference, closed by/at;
- reopened/adjusted indicator;
- one route to detail.

### Detail should contain

- frozen close summary;
- sales/payment/refund/expense breakdown;
- drawer evidence and settlement summary;
- corrections/reopen state;
- audit log;
- export.

### Accounting workspace should contain

- posting status and missing events;
- mapping/suspense exceptions;
- trial balance/journal trace;
- finance evidence and accounting approval/soft close.

These levels should not be merged into the ordinary completion receipt.

## 20. Current test coverage

### Backend coverage found

- configured business-date helper and exact-window behavior;
- half-open period inclusion and multi-day windows;
- drawer readiness, opening/retained float, sequential sessions, cutoff counts, movements, variances, settlement, reopening, and correction;
- order snapshot and finance-ledger fallback/overlay;
- payment/refund/expense/manual-income attribution;
- accounting bridge, cash short/over journals, idempotent variance event, missing-event posting, daybook blockers, review and API serialization;
- adjustments, rollback, period invalidation, and variance replacement/reversal;
- lock-policy/period preflight;
- response contracts, email service, PDF/report behavior;
- drawer permissions and accounting permission route contracts.

### Next.js coverage found

- `day-close-control-ui-contract.test.js` for typed APIs, drawer controls, operational status, and backend-authoritative snapshot evidence;
- Wave 2/2B finance UI contracts for route ownership and action hierarchy;
- snapshot view, payment summary, credit breakdown, order-print, API error parsing, and format unit tests;
- drawer business-date/readiness/selection and finance accounting review contracts.

Known current TypeScript issue: `lib/day-close-format.test.ts` passes nullable `period_start_at` and `period_end_at` fixture fields to a formatter expecting strings. This is a test typing problem unless runtime parsing can actually supply null to that call. It was inspected but not changed.

### Flutter coverage found

- exact period parsing and history range display;
- selected date forwarding to every pre-close endpoint;
- server date/reconfirm behavior;
- API error parsing for drawer blockers;
- accounting daybook repository;
- thermal summary/payment/drawer printing;
- role-permission relationships.

`day_close_bloc_test.dart` contains a large commented-out test group. This reduces confidence in state-transition regression coverage even though focused active tests exist.

### Important missing/regression tests to add before migration

- confirm double-submit and retry-after-commit response behavior;
- simultaneous managers confirming one ID;
- order/payment/refund arrival between readiness and confirmation;
- explicit configured-start-vs-exact-window contract at controller default date;
- reopen latest-close success (would catch the current undefined variable);
- cancel reason contract mismatch;
- mutation permission separation (view must not imply confirm/cancel if that is not intended);
- end-to-end non-accountant close with accounting blocker translated to plain language;
- accessibility and responsive workflow tests at 320/390/430/768/1024/1440.

## 21. The real user job

A closing manager needs to accomplish six business outcomes:

1. Confirm that the activity since the last close is the intended period.
2. Ensure operational sales are finished or intentionally canceled.
3. Ensure payments/refunds are in a valid state.
4. Ensure every required cash drawer has been counted and its cash destination decided.
5. Understand and acknowledge any cash difference or non-blocking warning.
6. Finalize an auditable close and retain a result that can be reviewed later.

They do **not** need to understand finance-event posting, journal trace, suspense accounts, or trial-balance mechanics. When those controls fail, the manager needs a plain blocker and a route to an authorized finance user.

## 22. Proposed simplified user model

### Step 1 — Review

Show one readiness list:

- Sales: ready or number of orders to finish.
- Payments: matched or issue count.
- Refunds: ready or pending count.
- Cash drawers: ready or drawers requiring action.
- Accounting check: ready or “Finance review required.”

Then show compact totals: sales, payments collected, refunds, expenses, cash expected. Payment/drawer breakdowns are expandable manager detail.

Primary action: **Continue**. If blocked, the primary actions appear on the affected issue rows instead.

### Step 2 — Confirm cash

When drawer controls are enabled:

- show each drawer’s expected/count/settlement status;
- open only the relevant count/settlement subflow;
- show aggregate “Cash expected,” “Cash counted,” and “Difference.”

When drawer controls are disabled:

- show the backend expected cash and an explicit manual count field if the domain continues to permit manual actual cash;
- do not manufacture counted cash by echoing expected cash without telling the user.

Primary action: **Review close**.

### Step 3 — Close

Show:

- date label and exact included period;
- final sales and collected payments;
- counted cash and over/short difference;
- unresolved warnings (not blockers);
- optional note.

Confirmation copy:

> Close the business period labelled 3 Sep 2026?
>
> Activity from [start] to [end] will be saved as an audited close. Later corrections may require an authorized adjustment or reopening the latest close.

Actions: **Cancel** and **Close day**.

Do not claim every transaction becomes immutable.

## 23. Proposed mobile UX

```text
<- Day close
3 Sep 2026
Activity included: 2 Sep 22:14 - now

Review

Sales                         Ready
NPR 42,300

Payments                      Ready
NPR 42,300 collected

Cash drawers             1 to finish >
2 of 3 settled

Refunds                       Ready

Accounting check              Ready

[ Continue ]
```

The screen uses grouped rows and dividers, not a card wall. Blockers appear at the top with a short explanation and direct action. A bottom action area contains one primary action and safe-area padding.

Step 2:

```text
<- Confirm cash

Main drawer                   Settled
Bar drawer               Needs count >

Cash the system expects    NPR 18,200
Cash counted               NPR 18,150
Difference               NPR 50 short

[ Review close ]
```

Completion:

```text
Day closed
3 Sep 2026

Sales                      NPR 42,300
Payments                   NPR 42,300
Cash difference          NPR 50 short

Closed by Mandeep
4 Sep 2026, 01:42

[ View close details ]
[ Return to dashboard ]
```

No confetti and no journal terminology.

## 24. Proposed desktop UX

Desktop preserves the same three steps. It must not become an accounting dashboard.

```text
Day close                         3 Sep 2026
Activity included: [start] - [end]

---------------------------------------------------------
Main review column                  Context column

Sales          Ready                Close status
Payments       Ready                Business line
Refunds        Ready                Exact period
Cash drawers   1 to finish          Warnings
Accounting     Ready

Expandable payment/drawer detail   [Continue]
---------------------------------------------------------
```

Use the right column for stable context, not duplicate totals. Drawer count/settlement can use an appropriately sized sheet/dialog while keeping the close context visible. Accounting detail links to the dedicated accounting Day Close route.

## 25. Information hierarchy

### Level 1 — normal closing user

- included period;
- readiness/blockers;
- sales and collected payments;
- drawer count status;
- cash expected/counted/difference;
- final close action and result.

### Level 2 — manager detail

- payment method/instrument breakdown;
- refunds, discounts, expenses, credit sales/collections;
- per-drawer expected/count/settlement;
- order exceptions and non-blocking warnings;
- confirmation note and audit identity.

### Level 3 — accounting detail

- finance events and posting counts;
- account mappings/suspense;
- journals and trial balance;
- variance event/journal;
- accounting review/approval/soft close;
- source evidence trace.

Level 3 remains in `/finance/accounting/day-closes` and the advanced portion of close detail, not the default flow.

## 26. Migration plan

### Day Close 0 — Domain correctness before UI

- Decide whether exact continuous windows or configured business-day starts are the intended product rule.
- Unify controller default-date semantics with the chosen rule.
- Normalize inclusive/exclusive window boundaries.
- Fix and test reopen’s undefined scope variable.
- Decide and enforce mutation permission separation.
- Specify retry/idempotency and concurrent-confirm behavior.
- Resolve cancel-reason contract mismatch.

No visual migration should claim a simple/reliable flow until these are closed.

### Day Close 1 — Presentation contract and terminology

- Completed. Backend-facing readiness categories are presented as blockers,
  warnings, or information without changing their domain severity.
- `lib/presentation/day-close.ts` adapts typed validation, snapshot, detail, and
  explicit capability inputs. It formats values but does not fetch, mutate,
  reconcile, sum payment buckets, or calculate expected/count/difference cash.
- Normal closing users receive task language; raw issue codes and backend
  messages are retained as diagnostic metadata for finance/support surfaces.

### Day Close 2 — Mobile-first operational flow

- Build Review, Confirm cash, and Close steps.
- Extract drawer interventions from the always-visible full drawer workspace.
- Add a concise final confirmation and completion state.
- Preserve all existing backend calls initially to limit accounting risk.

### Day Close 3 — Desktop workspace

- Apply the same mental model with main/context columns.
- Keep one primary action per step.
- Link, rather than embed, deep accounting review.

### Day Close 4 — History and detail

- Create a compact close register.
- Separate operational summary, drawer/payment detail, corrections, audit, and accounting evidence.
- Preserve export and source evidence.

### Day Close 5 — Corrections and reopen

- After backend hardening, create explicit latest-close reopen and older-close correction flows.
- Show permissions and consequences before mutation.
- Verify drawer settlement reversal and accounting variance replacement end to end.

### Day Close 6 — Regression and release validation

- Backend exact-window, drawer, posting, adjustment, concurrency, and permission tests.
- Next.js contracts plus mobile/desktop accessibility/responsive tests.
- Flutter parity tests for the same domain states.
- Manual QA with no drawers, one drawer, multiple drawers, variance, split payments, credit, refund, accounting blocker, skipped days, late close, reopen, and correction.

## 27. Open questions and unsupported assumptions

1. Which rule is product-authoritative going forward: configured business-day start or continuous previous-close-to-now windows? Current code contains both concepts.
2. Should a completed but partially paid order be accepted because it is assigned to credit, or can any underpayment pass? The current validation does not distinguish these cases.
3. Should ordinary view permission authorize initiate/confirm/cancel, or is this legacy compatibility?
4. What response should a repeated confirm return after a client timeout: idempotent success or conflict with a link to the confirmed record?
5. Is a restaurant-wide close mutex required, or is exact end-time partitioning considered sufficient during concurrent service?
6. Should missing non-cash payment instruments remain warning-only?
7. Is Combined scope intentionally excluded from the general-ledger bridge, or should restaurant events within it receive the same accounting preflight?
8. Should configured business-day changes affect only future labels, future window starts, or neither?
9. Is report email delivery operationally required, and if it fails should the UI expose a retry separate from close status?
10. Should receipt documentation completeness become a real warning? It is currently a placeholder.
11. Is Flutter expected to remain a parallel Day Close UI, or should both clients consume a shared presentation/readiness contract?
12. What explicit domain locks should prevent historical order/payment/refund edits after close? Day Close itself does not supply a universal lock.

These are unresolved product/domain decisions. This audit does not treat them as implemented behavior.

## 28. Resolved Day Close Domain Contract

Day Close 0 resolves the operational contradictions above. This contract is
authoritative for new closes; saved historical windows are never recomputed.

### Close window and business date

- A close owns one continuous half-open interval: `[period_start_at, period_end_at)`.
- A subsequent close starts at the previous confirmed close's exact `period_end_at`.
- The first close starts at restaurant-local midnight, except that an earlier
  verified, unlinked drawer opening may extend that first boundary.
- Confirmation time is the new `period_end_at`. Records exactly at the start are
  included; records exactly at the end belong to the next close.
- `business_date` is an accounting/reporting label derived in restaurant local
  time. `business_day_start_time` is not a Day Close boundary authority.
- Changing timezone/business-day settings does not rewrite persisted windows.

### Capabilities

- `reports.dayclose.view` and `reports.daily.view` are read-only.
- Initiate, confirm, and cancel each require their explicit Day Close capability.
- Reopen and financial adjustment remain exceptional capabilities.
- Existing manager presets already carry the explicit mutation permissions;
  cashier and accountant presets remain read-only unless intentionally granted.

### Settlement readiness

- Completed orders require positive successful settlement evidence equal to the
  order total.
- Cash, card, digital, explicit credit, and room-charge/account settlement rows
  are recognized settlement evidence.
- Successful negative refund rows are refund evidence and do not create a false
  original-sale shortfall.
- Overpayment produces `PAYMENT_OVERPAID`; an unexplained gap produces
  `PAYMENT_UNEXPLAINED_SHORTFALL`.

### Readiness and accounting diagnostics

- Readiness responses retain legacy display strings and additionally expose
  machine-readable issues with `blocker`, `warning`, or `info` severity.
- Stable operational codes include `ORDER_OPEN`, `PAYMENT_OVERPAID`,
  `PAYMENT_UNEXPLAINED_SHORTFALL`, `REFUND_PENDING`, and `DRAWER_NOT_READY`.
- Normal users receive `ACCOUNTING_REVIEW_REQUIRED`; raw daybook exception kinds
  remain available as diagnostic codes and through the finance daybook evidence.

### Cash authority and drawers

- With drawer controls enabled, approved drawer evidence is authoritative and
  `cash_count_source=drawer_evidence`.
- Without drawer controls, a supplied count is persisted as
  `cash_count_source=manual_count` and `counted_cash`.
- If no count occurred, expected cash may be carried as the compatibility
  reconciliation value, but `cash_count_source=not_counted` and
  `counted_cash=null` prevent the UI from claiming that cash was counted.
- Drawer readiness is exposed as `ready`, `needs_open`, `needs_count`,
  `needs_recount`, `needs_variance_approval`, or `needs_settlement`. Day Close
  still does not make drawer decisions automatically.

### Confirmation, concurrency, cancellation, and reopen

- Confirmation locks the Day Close row with `SELECT ... FOR UPDATE` before state
  validation. Only one request can finalize the record.
- An exact retry of an already committed confirmation returns the confirmed
  record. A different payload returns
  `DAY_CLOSE_CONFIRM_REPLAY_MISMATCH` (409).
- The final timestamp partitions near-boundary activity: timestamps before the
  captured end are in this close; timestamps at/after it belong to the next.
- Cancellation reason is accepted and persisted in the audit log. Legacy callers
  that omit it receive an explicit compatibility reason rather than empty audit
  evidence.
- Only the latest confirmed close in the same business-line scope may reopen.
  Reopen keeps the same ID, clears confirmation/cash-count evidence, reverses
  linked variance accounting, reopens linked drawers, and invalidates dependent
  period closes before reconfirmation.

### Combined scope

`combined` remains an operational Hotel + Restaurant summary and intentionally
does not run the Restaurant general-ledger confirmation bridge. This phase does
not change journals or migrate historical Combined closes. Any future decision
to give Combined scope general-ledger authority requires a separate accounting
migration.

## 29. Day Close Presentation Contract

Day Close 1 is **PRESENTATION-CONTRACT COMPLETE**. This phase establishes the
model consumed by the current flow and the future Day Close 2 responsive UI; it
does not redesign the full workspace.

### Adapter boundary

`buildDayClosePresentation` accepts already parsed backend validation, snapshot,
and close-detail records plus explicit user capabilities and section
availability. It returns:

- the business-date label and exact `Activity included` range;
- Sales, Payments collected, Refunds, Cash, and Accounting readiness;
- backend-authoritative Sales, Payments collected, Refunds, Expenses, and Cash
  expected values;
- expected cash, counted cash, backend cash difference, count provenance, and
  focused drawer actions;
- plain-language blocker, warning, and information rows;
- separate view/initiate/confirm/cancel/reopen/adjust capabilities; and
- a deterministic next action for navigation only.

The adapter never fetches or mutates data and never calculates settlement,
expected cash, counted cash, drawer variance, payment reconciliation, or
accounting decisions.

### Availability and readiness

Each readiness area is `loading`, `available`, or `unavailable` before it is
presented as Ready, Action required, Review recommended, or Unavailable. Missing
data is never converted to a healthy status or a zero amount. Accounting remains
Unavailable until explicit accounting evidence is supplied.

### Plain-language issues

Stable codes map to manager tasks: open orders, overpayments, unexplained
shortfalls, pending refunds, drawer work, and finance review. The normal flow
does not expose journals, suspense, finance events, trial balance, or raw
imbalance text. `ACCOUNTING_REVIEW_REQUIRED` links authorized users to the
dedicated finance-review workspace, where diagnostic evidence remains available.

### Cash provenance

`drawer_evidence`, `manual_count`, and `not_counted` are shown respectively as
`Counted from cash drawers`, `Manually counted`, and `Not counted`. A missing
count stays absent rather than becoming `NPR 0.00`. Cash difference uses the
backend variance/discrepancy field; the adapter does not subtract values.

### Permission and action contract

The presentation model preserves `canView`, `canInitiate`, `canConfirm`,
`canCancel`, `canReopen`, and `canAdjust` separately. The current web UI now
hides mutation actions that the user cannot perform instead of treating view
permission as mutation authority. Next action is limited to `FIX_BLOCKERS`,
`RESOLVE_CASH`, `CONTINUE`, `REVIEW_CLOSE`, `CLOSE_DAY`, or `VIEW_RESULT` and
does not make accounting decisions.

### Prepared history and completion data

Reusable helpers now prepare the business date, covered range, business line,
status, sales, backend cash difference, close identity/timestamp slots, and
reopened/adjusted indicator for Day Close history. Completion presentation uses
Day closed, the business date, activity range, sales, payments collected,
counted cash, cash difference, and retained warnings without accounting
internals. Full history and workspace composition remain Day Close 2+ work.

## 30. Day Close 2 - mobile-first operational flow

`/day-close` now owns the canonical manager workflow. The route presents one
narrow, touch-first sequence: Review, Cash, Close, and Completion. Analytics and
history links navigate into this route instead of opening the former giant
modal.

Review shows the five readiness areas, blockers before warnings, and a compact
closing summary. Cash uses the backend-provided expected amount, drawer count,
and variance. Drawer operations remain available only as a focused subflow;
the full drawer panel is not permanently embedded. Close summarizes the
business date, covered range, sales, payments, and cash before confirmation.
Completion preserves the authoritative close result and links to close details
or the dashboard.

The flow consumes `lib/presentation/day-close.ts`; it does not recreate
accounting, cash, drawer, or readiness calculations in the client. Day Close
history remains available without redesign, and no full daybook is embedded.

**Status:** Day Close 2 - MOBILE FLOW IMPLEMENTED, pending manual QA at 390px
and functional desktop review at 1440px. Day Close 3 has not started.

## 31. Day Close 2.5 - evidence, insights, and reporting contract

Day Close 2.5 is **EVIDENCE & REPORTING CONTRACT AUDITED**. The complete metric
lineage, snapshot inventory, insight-readiness matrix, drill-down identity model,
live/frozen behavior, email/export contracts, and Day Close 2.6 staging plan are
recorded in [DAY_CLOSE_METRIC_LINEAGE.md](./DAY_CLOSE_METRIC_LINEAGE.md).

### Audit conclusion

The current Day Close snapshot already preserves a broad operational evidence
set. Its financial summary is sourced through the exact-window
Finance/Analytics contract and carries source/completeness metadata. It also
stores completed-order, payment, refund, expense, manual-income, drawer,
receivable, item, category, table, purchase-summary, and validation evidence.

That does not make every requested insight ready. The current implementation has
important contract gaps:

- tax and service charge are not self-contained in the detailed snapshot;
- customer, staff, supplier, category, and menu-item identity is absent from
  several aggregates;
- purchase fields mix period activity with an open-at-close set;
- purchase returns are not frozen distinctly;
- refund and expense rows need typed source-document identity;
- hourly sales uses a bucket that is not yet safe as restaurant-local time; and
- current frontend compatibility helpers can present missing numeric data as
  zero.

No new ranking should be rendered until its population, measure, exclusions,
refund treatment, tie handling, currency, stable IDs, and minimum evidence are
backed by a shared backend contract.

### Authority and period semantics

- Finance/reporting remains authoritative for financial totals.
- Shared backend operational aggregations must own item, category, table,
  channel, customer, staff, and supplier insight calculations.
- Day Close uses the exact half-open interval
  `[period_start_at, period_end_at)` for the selected business-line scope.
- Sales, collections, refunds, expenses, purchases, credit sales, and credit
  collections are period movements.
- outstanding receivables, supplier balances, and custody/count evidence are
  point-in-time or boundary values and must be labeled `at close`.
- React may format and present already-valid rows; it must not calculate
  authoritative totals.

### Readiness boundary

Currently safe summary evidence includes canonical sales, collections, refunds,
expenses, credit movement, receivables-at-close, drawer reconciliation,
completed/cancelled order counts, average order value, channel evidence, and
completed-order table evidence. Full source navigation still requires identity
extensions for several sections.

Most-sold/highest-sales item rankings, category rankings, localized hourly
sales, and supplier purchase rankings require a shared aggregation. Customer,
server/staff, and cashier rankings are not reliably attributable from the
current frozen snapshot and must not be inferred from names or descriptions.

### One evidence model

Day Close 2.6 should introduce one versioned `DayCloseEvidence` model with:

- `overview`;
- `moneyMovement`;
- `sales`;
- `customers`;
- `staff`;
- `cash`;
- `outgoings`;
- `purchases`;
- `suppliers`;
- `credit`;
- `orders`; and
- `accountingAudit`.

Every section must contain explicit `availability`, `summary`, `insights`,
`breakdowns`, `sourceRows`, and `warnings`. Missing data remains unavailable;
it is never inferred as empty or zero.

Before confirmation this model is live and refreshable. Confirmation regenerates
it at the final server boundary and freezes the displayed values, source rows,
IDs, versions, provenance, and warnings. Historical detail, email, PDF, and Excel
must consume frozen evidence so later reporting changes cannot silently rewrite
the closed day.

### Day Close 2.6 sequence

1. canonical/shared metric fixes;
2. snapshot and evidence extensions;
3. shared `DayCloseEvidenceView`;
4. typed source-document drill-down;
5. concise close email; and
6. detailed device exports.

This audit makes no UI, API, posting, accounting, snapshot, or historical-data
change. Day Close 3 has not started.

## 32. Day Close 2.6A - canonical metrics

Day Close 2.6A is **CANONICAL METRICS COMPLETE**. A backend-owned exact-period
contract now feeds Finance, the semantically equivalent Analytics finance
summary, and the live/future Day Close snapshot. The contract uses UTC
`[period_start_at, period_end_at)` boundaries and carries ledger completeness,
source, fallback state, and warnings.

The Day Close snapshot builder no longer obtains financial truth through an
Analytics cache or rebuild sales/payment totals from its loaded order rows.
Payment totals, method groups, and instrument groups share one collection-event
population. Tax and service charge are read from recognized-sale event metadata;
the incomplete-ledger fallback reads the matching completed-order values and is
explicitly identified.

Confirmed historical snapshots are not recalculated. Purchases, purchase
payments, supplier payable-at-end, item/category net allocation, and localized
hourly sales remain unavailable as canonical metrics. Customer, staff, cashier,
and supplier rankings remain deferred attribution. No evidence UI, email/export
redesign, or Day Close 3 desktop work is part of this phase.

## 33. Day Close 2.6B - frozen evidence and attribution

Day Close 2.6B is **VERSIONED EVIDENCE CONTRACT COMPLETE**. The backend now
builds typed operational evidence independently of the canonical financial
totals, using the identical exact UTC `[start, end)` close window. Live snapshots
may refresh before confirmation. Successful confirmation regenerates at the
server-owned final boundary and freezes the operational evidence, drawer result,
identities, displayed names, source IDs, provenance, warnings, and availability
states under `day-close.evidence.v1`.

Compatibility is intentionally one-way: a versioned payload can be parsed, but
an older confirmed snapshot is not enriched from current orders, users,
customers, menu configuration, suppliers, or tables. Its evidence is reported as
unavailable. This prevents historical screens and future exports from changing
when master data changes.

Attribution is explicit. Orders retain separate creator and completer identities;
customers require a real customer ID; tables require an order-table relation;
suppliers require the purchase/supplier relation. Server and cashier rankings are
deferred because their authoritative identities are not consistently present in
the current source rows. The contract never substitutes the logged-in user,
drawer owner, free-text customer name, transaction description, or amount match.

Operational rows keep drill-down-ready stable IDs and frozen display names.
Item rankings disclose that their subtotal is before order-level discount and
refund allocation. Purchase, purchase payment, supplier payable, and purchase
return evidence disclose current-versus-legacy coverage. Availability metadata
is part of the response, so missing coverage cannot masquerade as a real zero.

This phase does not add `DayCloseEvidenceView`, source-detail navigation, email,
PDF/Excel export, or a redesigned Day Close surface. Those remain later slices.

## 34. Day Close 2.6C - rich evidence view

Day Close 2.6C is **RICH EVIDENCE VIEW IMPLEMENTED, pending manual QA**. One
shared `DayCloseEvidenceView` now renders both live `day-close.evidence.v1`
responses and frozen confirmed evidence. Review, final review, and completion
remain concise; each exposes a deliberate `View day report` action instead of
embedding the full report in the close workflow.

The report is mobile-first and vertically structured around At a glance, Money
movement, Sales and service, Cash control, Customers, Expenses and refunds,
Purchases and suppliers, Credit and receivables, Day activity, and Accounting
and audit. Evidence families use progressive disclosure, compact metrics, rows,
and dividers instead of a tab wall or dashboard-card wall. Mobile uses a compact
section jump sheet; large screens add a small sticky section index without
changing the surrounding Day Close workspace.

Availability remains part of the presentation contract. Partial, unavailable,
deferred, and not-applicable evidence cannot become zero. Customer and purchase
limitations are disclosed; cashier/server rankings remain absent; item quantity
and item subtotal rankings retain their exact canonical names. Sales refunds,
item returns, and credit-note coverage remain separate.

The report does not calculate authoritative financial totals in React. It
formats the frozen/live canonical values and displays the server-ranked and
server-bucketed operational evidence. Searchable order and purchase registers
are bounded to an initial page with explicit load-more behavior and stay outside
the main report body.

Historical v1 closes use the same frozen evidence view. Legacy snapshots keep
their original saved presentation and are never enriched from current entities.
No 2.6D source-route drill-down, email/export redesign, or Day Close 3 desktop
workspace work is included.

## 35. Final product ownership - simplified financial close

The rich-evidence manager UI described in section 34 is **superseded**. The
`day-close.evidence.v1` contract remains frozen infrastructure for audit,
exports, support, and historical integrity, but it is no longer the normal Day
Close browsing experience.

Final ownership is explicit:

- **Day Close** owns financial finalization, financial reconciliation, cash
  confirmation, and only the operational checks that can block a safe close.
- **Analytics** owns sales trends, items, categories, tables, hourly activity,
  customers, staff, suppliers, comparisons, and date-range exploration.
- **Finance / Accounting** owns posting, journals, suspense, trial balance,
  account evidence, corrections affecting the books, and finance review.

The manager flow remains Review -> Confirm cash -> Review close -> Completion.
Its primary presentation is flat readiness rows, one backend-owned financial
statement, cash reconciliation, and one irreversible `Close day` action. New v1
history details use the same concise financial model. Legacy closes retain their
saved report and are labelled `Legacy close record`; they are not reconstructed.
