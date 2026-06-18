# Mapping Exception Repost Validation - 2026-06-19

Scope: backend and Next.js resolver work for clearing already-posted mapping exceptions from suspense.

## Backend

Repository: `C:\yummy_backend`

Focused command:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_exception_repost_spec.py tests\finance\test_accounting_mapping_management_spec.py tests\finance\test_journal_reversals_spec.py -q --tb=short --disable-warnings
```

Result: `10 passed, 47 warnings in 20.71s`.

Combined command:

```powershell
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_exception_repost_spec.py tests\finance\test_accounting_daybook_spec.py tests\finance\test_accounting_setup_core_mapping_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

Result: `14 passed, 120 warnings in 69.19s`.

Coverage:

- `refund_liability_created` now uses its payment-agnostic default mapping for cash and digital events instead of posting to suspense.
- Existing suspense finance-event journals can be reversed with system override and reposted through the active mapping.
- Blocking suspense metrics ignore reversal audit entries and count unresolved original finance-event suspense postings.

## Next.js

Repository: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs`

Commands:

```powershell
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit
npm run lint
npm run build
```

Results:

- Accounting UI contract: `27 pass`.
- Day-close drawer controls contract: `3 pass`.
- TypeScript: exit code `0`.
- Lint: exit code `0`; existing unrelated warnings remain.
- Production build: exit code `0`; generated accounting and day-close routes.

Build note: `npm run build` was initially blocked by the repository guard because `next dev` was running. The dev process was stopped, the production build passed, and `npm run dev` was restarted afterward. The restarted web server reported `http://localhost:3000`.

## Browser Test Expectation

After backend restart, the mapping exception resolver should show enabled `Open source trace` and `Reverse and repost` actions. For the current `refund_liability_created` cash/digital suspense rows, `Reverse and repost` should reverse the old suspense journal, repost through `4010 Sales Returns` and `2100 Refund Liability`, refresh accounting health, and reduce suspense to zero when both rows are processed.

