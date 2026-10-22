# Finance mobile architecture

## Purpose

Finance is a set of related jobs, not a directory of isolated reports. On a
phone the user must be able to answer three questions without learning a new
layout on each route:

1. What money or document needs attention?
2. What can I record or settle now?
3. Where can I inspect the evidence?

This document is the contract for active Next.js Finance routes. It is not a
specification for the Flutter client and does not change finance API or
accounting behaviour.

## Mobile workspace map

The Finance workspace has a fixed five-item rail on top-level routes. It is a
workspace switcher, not a second application-wide navigation bar.

| Rail item | Job | Route |
| --- | --- | --- |
| Overview | health, attention and common tasks | `/finance` |
| Sales | completed sales, invoices and sales returns | `/finance/sales` |
| Purchases | purchase documents and returns | `/finance/purchases` |
| Cash | cash/bank position and control actions | `/finance/operations` |
| More | secondary record, review and setup jobs | sheet |

The **More** sheet is grouped by intent:

- Record and settle: Other income, Expenses, Payments
- Control cash: Cash drawers, Day close
- Review and configure: Transactions, Journal vouchers, Reports, Setup

Internal routes do not repeat this rail. The global app bar owns the screen
title and back action, leaving the content area for the current job.

## Shared page order

Every mobile finance page follows this order unless the task is a full-screen
creation flow:

```text
app bar
workspace rail (top-level routes only)
page-specific tabs (only when they change the same job)
search
filters
summary / attention
register list
contextual primary action
```

- Search appears before filters when it changes the visible register.
- Filters open in a sheet when there are more than two inputs. Quick date
  choices remain visible in that sheet rather than consuming the page header.
- A summary is limited to values needed to decide the next action. It is not a
  dashboard repeated above every list.
- Mobile lists use one semantic row per document or event. Desktop tables are
  retained only from `md` upward and live in bounded horizontal containers.
- A destructive action sits in a row overflow or a confirmation sheet; it is
  never promoted beside the normal record action.

## Route and workflow contract

| Family | Mobile primary flow | Search / filters | List and action treatment |
| --- | --- | --- | --- |
| Overview | See money, attention and daily work | Find a finance task | Grouped task rows; no report-like tables |
| Sales | New POS sale or manual sale, then invoice/return detail | Search invoices or completed sales; date, status, customer and method filters | One document per row; record sale is primary; return is contextual |
| Purchases | Record purchase, receive/return or settle it | Search supplier/reference; lifecycle and business-line filters | Supplier, state, date and total in one row; returns are a separate contextual tab/route |
| Other income | Record income | Date, station/business and source filters | Income documents; one clear record action |
| Expenses | Record expense | Date, station and expense-head filters | Recognized cost and entry count are compact summary values; export belongs at the register header |
| Payments | Review successful collections and settlements | Date, method, bill/reference and account filters | Payment rows identify source, method, route and amount; this route is not a launcher for customer/supplier/staff workflows |
| Cash & banks | Review balances and move/settle funds | Business/date filters | Account or drawer rows lead to focused action screens |
| Cash drawers | Open, count, transfer and close cash | Session/date/status filters | Current drawer comes before history; history remains secondary |
| Day close | Review warnings, count and confirm a business day | Business date and business-line controls | One confirmation CTA after checks; previous closes are review-only history |
| Transactions | Find ledger events and inspect evidence | Search plus date/type/account/party filters | Semantic event rows; a detail sheet contains the accounting evidence |
| Journal vouchers | Review or record a manual adjustment | Date/status/reference filters | Voucher rows lead to detail; manual journal is the only primary action |
| Reports | Choose a report, then filter and read it | A report-specific filter sheet | Phone output is summary plus semantic rows; full table is desktop-only |
| Setup | Configure heads, opening balances and rules | No global search unless the setup data is a large register | Group related configuration links and warn before financially material changes |

## Forms and return flows

Financial creation is a focused workflow, so its form owns the full mobile
viewport while retaining the global app bar back affordance.

```text
app bar with Back
form title and short consequence
required identity/date fields
lines or allocations
payment/settlement decision
total or impact
fixed Cancel + Save footer
```

- Do not place two unrelated required fields side-by-side below `sm`.
- Long line-item editors become stacked line sections on phones. A wide table
  is desktop-only.
- The save label names the irreversible result: `Record expense`, `Post
  return`, `Record invoice`, never `Submit`.
- Return flows show the source document first, then return lines, settlement
  outcome and a fixed `Post return` action.
- A dialog may be used for a short, reversible selection; long creation and
  return work uses the mobile full-height dialog pattern with a fixed footer.

## Accounting boundary

`/finance/accounting/*` currently redirects to `/finance/operations`. Those
pages are not an active second Finance product and must not be visually
reimplemented in parallel. The active reporting ledger clients under
`/finance/reports/*` remain the operational reporting surface. Any future
Accounting V2 re-enable must first choose whether it replaces or adapts this
active report layer.

## Acceptance checklist

- Test 320px, 390px and 412px widths with no page-level horizontal scroll.
- Verify search, filters, a populated list, empty state and loading state for
  each register.
- Verify desktop tables appear only at `md` and have a mobile row alternative.
- Verify dialog forms keep actions visible when the keyboard reduces height.
- Verify a route change preserves the API, permissions, and accounting
  contract; this architecture only changes presentation and interaction
  hierarchy.
