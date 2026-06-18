# Mapping Exception Repost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let accountants clear already-posted suspense mapping exceptions from the web resolver by tracing source evidence and running an audited reverse-and-repost action.

**Architecture:** Add a backend resolver service that finds unreversed suspense journals for one exception key, reverses them with existing journal reversal semantics, reposts replacement journals using the currently active ledger mapping, and returns an auditable summary. Wire the Next.js resolver to source trace and reverse/repost endpoints with confirmation and refresh.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, pytest, Next.js 14, TypeScript, React, existing shadcn/ui components.

---

### Task 1: Backend Reverse-Repost Contract

**Files:**
- Modify: `C:\yummy_backend\app\schema\accounting_schema.py`
- Modify: `C:\yummy_backend\app\services\accounting_service.py`
- Modify: `C:\yummy_backend\app\controller\accounting_controller.py`
- Test: `C:\yummy_backend\tests\finance\test_accounting_mapping_exception_repost_spec.py`

- [ ] **Step 1: Write failing service test**

Add a test that creates two `refund_liability_created` finance events, forces their original journals into suspense, then calls `AccountingExceptionResolverService.reverse_and_repost_exception(...)`.

Expected assertions:

```python
assert result.reversed_count == 2
assert result.reposted_count == 2
assert result.suspense_amount_before == 1060.0
assert result.suspense_amount_after == 0.0
assert all(entry.status.value == "reversed" for entry in original_entries)
assert replacement_lines_by_code == {"4010": Decimal("1060.00"), "2100": Decimal("1060.00")}
```

Run:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_exception_repost_spec.py -q --tb=short
```

Expected: fail because schema/service do not exist.

- [ ] **Step 2: Add request and response schemas**

Add these Pydantic models:

```python
class MappingExceptionRepostRequest(BaseModel):
    restaurant_id: int
    event_type: str
    payment_method: Optional[str] = None
    business_line: str = "restaurant"
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    reversal_date: Optional[date] = None
    reason: str


class MappingExceptionRepostRead(BaseModel):
    restaurant_id: int
    event_type: str
    payment_method: Optional[str] = None
    business_line: str
    reversed_count: int = 0
    reposted_count: int = 0
    skipped_count: int = 0
    suspense_amount_before: float = 0.0
    suspense_amount_after: float = 0.0
    reversed_journal_entry_ids: list[int] = Field(default_factory=list)
    reposted_journal_entry_ids: list[int] = Field(default_factory=list)
```

- [ ] **Step 3: Implement reverse-and-repost service**

Add `AccountingExceptionResolverService.reverse_and_repost_exception(payload, actor_id=None)`:

```python
async def reverse_and_repost_exception(
    self,
    payload: MappingExceptionRepostRequest,
    *,
    actor_id: Optional[int] = None,
) -> MappingExceptionRepostResult:
    if not payload.reason.strip():
        raise ValueError("Reason is required.")
    mapping = await AccountingPostingService(self.db)._mapping_for_exception_key(
        payload.restaurant_id,
        payload.event_type,
        payload.payment_method,
        payload.business_line or "restaurant",
    )
    if mapping is None:
        raise ValueError("Create an active ledger mapping before reverse and repost.")
    entries = await self._suspense_entries_for_exception(payload)
    if not entries:
        return empty result with zero counts
    for entry in entries:
        await JournalVoucherService(self.db).reverse_entry(
            entry.id,
            JournalEntryReverseRequest(
                reversal_date=payload.reversal_date or entry.entry_date,
                memo=f"Reverse suspense mapping exception: {payload.reason}",
                allow_system_override=True,
            ),
            reversed_by_id=actor_id,
            commit=False,
        )
        replacement = await AccountingPostingService(self.db).repost_reversed_finance_event(
            entry.finance_event,
            mapping,
            original_entry_id=entry.id,
            actor_id=actor_id,
            reason=payload.reason,
        )
```

The replacement journal must use `source_key=f"{event.event_key}:repost:{entry.id}"` so it does not violate the existing unique source key for the reversed original.

- [ ] **Step 4: Add controller endpoint**

Add:

```python
@router.post(
    "/mapping-exceptions/reverse-repost",
    response_model=BaseResponse[MappingExceptionRepostRead],
    dependencies=[Depends(require_permission("finance.accounting.setup"))],
)
async def reverse_repost_mapping_exception(...)
```

It calls the service, commits on success, rolls back on `ValueError`, and returns `"Mapping exception reversed and reposted"`.

- [ ] **Step 5: Run backend tests and commit**

Run:

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_exception_repost_spec.py tests\finance\test_accounting_mapping_management_spec.py tests\finance\test_journal_reversals_spec.py -q --tb=short --disable-warnings
```

Expected: all pass.

Commit:

```powershell
git add app\schema\accounting_schema.py app\services\accounting_service.py app\controller\accounting_controller.py tests\finance\test_accounting_mapping_exception_repost_spec.py
git commit -m "feat: reverse and repost mapping exceptions"
```

### Task 2: Next.js Resolver Actions

**Files:**
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\lib\api\endpoints.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\types\accounting.ts`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\mapping-exception-resolver.tsx`
- Modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\components\finance\accounting\accounting-overview-client.tsx`
- Test: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\scripts\__tests__\accounting-ui-contract.test.js`

- [ ] **Step 1: Add failing UI contract assertions**

Assert the resolver contains:

```js
"AccountingApis.reverseRepostMappingException",
"MappingExceptionRepostRequest",
"MappingExceptionRepostResult",
"Reverse and repost",
"Open source trace",
"This reverses existing suspense journals and reposts them through the active mapping."
```

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
```

Expected: fail because endpoint/types/action are not wired.

- [ ] **Step 2: Add endpoint and types**

Add:

```ts
reverseRepostMappingException: () => "/accounting/mapping-exceptions/reverse-repost",
```

Add:

```ts
export interface MappingExceptionRepostRequest {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  date_from?: string | null;
  date_to?: string | null;
  reversal_date?: string | null;
  reason: string;
}

export interface MappingExceptionRepostResult {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  reversed_count: number;
  reposted_count: number;
  skipped_count: number;
  suspense_amount_before: number;
  suspense_amount_after: number;
  reversed_journal_entry_ids: number[];
  reposted_journal_entry_ids: number[];
}
```

- [ ] **Step 3: Wire resolver action**

Change `MappingExceptionResolver` props:

```ts
onReverseRepost: (row: MappingExceptionRow) => Promise<void>;
busyKey?: string | null;
```

Enable the button and call `onReverseRepost(row)` after browser confirmation:

```ts
if (!window.confirm(`Reverse and repost ${row.count} suspense journal(s) for Rs. ${amount}?`)) return;
await onReverseRepost(row);
```

- [ ] **Step 4: Implement parent handler**

In `accounting-overview-client.tsx`, post:

```ts
await apiClient.post<BaseResponse<MappingExceptionRepostResult>>(
  AccountingApis.reverseRepostMappingException(),
  {
    restaurant_id: restaurantId,
    event_type: row.event_type,
    payment_method: row.payment_method,
    business_line: row.business_line,
    date_from: filters.date_from || null,
    date_to: filters.date_to || null,
    reason: `Reverse and repost mapping exception from accounting overview`,
  }
);
```

Then refresh health, reports, and mapping exceptions.

- [ ] **Step 5: Run web checks and commit**

Run:

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
npx tsc --noEmit
npm run lint
```

Expected: contract, TypeScript, and lint exit `0`; existing unrelated lint warnings may remain.

Commit:

```powershell
git add lib\api\endpoints.ts types\accounting.ts components\finance\accounting\mapping-exception-resolver.tsx components\finance\accounting\accounting-overview-client.tsx scripts\__tests__\accounting-ui-contract.test.js
git commit -m "feat: wire mapping exception repost action"
```

### Task 3: End-to-End Validation

**Files:**
- Create or modify: `C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs\docs\superpowers\verification\2026-06-19-mapping-exception-repost-validation.md`

- [ ] **Step 1: Run combined backend validation**

```powershell
cd C:\yummy_backend
venv\Scripts\python.exe -m pytest tests\finance\test_accounting_mapping_exception_repost_spec.py tests\finance\test_accounting_daybook_spec.py tests\finance\test_accounting_setup_core_mapping_spec.py tests\finance\test_day_close_accounting_review_spec.py -q --tb=short --disable-warnings
```

- [ ] **Step 2: Run combined web validation**

```powershell
cd C:\Users\PREDATOR\OneDrive\Desktop\yummy-desktop-nextjs
node scripts\__tests__\accounting-ui-contract.test.js
node scripts\__tests__\day-close-control-ui-contract.test.js
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 3: Record validation evidence**

Write command outputs and remaining caveats:

```markdown
# Mapping Exception Repost Validation - 2026-06-19

Backend: ...
Web: ...
Manual browser note: reverse/repost button should now be enabled for suspense rows once a mapping exists.
```

- [ ] **Step 4: Commit validation note**

```powershell
git add docs\superpowers\verification\2026-06-19-mapping-exception-repost-validation.md
git commit -m "docs: validate mapping exception repost"
```

---

## Self-Review

- Spec coverage: covers source visibility, audited reverse/repost, web resolver enablement, and validation.
- Placeholder scan: no open placeholders remain.
- Type consistency: backend `MappingExceptionRepost*` names match web `MappingExceptionRepost*` types and endpoint.
