# VAT reports in the current Finance workspace

VAT Summary is available at `/finance/reports/vat-summary`, alongside VAT Sales in
Finance > Reports. It uses `GET /finance-reports/vat-summary` and the refactored
finance reporting ledger service. The endpoint uses the restaurant in the signed-in
token, the existing finance reports feature gate, and `finance.reports.tax.view`.

The screen displays output VAT, claimed input VAT and the period's net VAT balance,
including posted return and reversal lines. Historical purchase review counts remain
visible. Users with account-view permission can inspect the underlying account
entries; users with report-export permission can export a working spreadsheet.
The summary is not a filing-ready return and does not automatically claim purchase VAT.

The `/finance/accounting` UI has been retired. Its route tree contains only a
redirect handler for existing bookmarks. Current Daybook components were moved into
`components/finance/reports`; the unused legacy screens and navigation were removed.
Legacy journal IDs are not reinterpreted as IDs from the new reporting ledger.

Deploy the backend endpoint together with this frontend change. Existing posting
calculations, database records and older API routes are unchanged.

Validation: focused VAT UI, legacy redirect, sidebar/access and day-close navigation
tests; TypeScript and focused ESLint; backend route tests without database writes.
