import type { AxiosInstance } from "axios";
import { ExpenseApis } from "@/lib/api/endpoints";
import {
  getClientTimezone,
  resolveBusinessLineParam,
  resolveStationParam,
  type FinanceBusinessLine,
} from "@/lib/finance-query";

export type ExpenseSummaryTotal = {
  total_amount: number;
  total_count: number;
};

export type ExpenseListFilters = {
  restaurantId: number;
  dateFrom: string;
  dateTo: string;
  station?: string;
  categoryId?: number;
  businessLine?: FinanceBusinessLine;
  timezone?: string;
};

const EXPENSE_PAGE_LIMIT = 200;

function buildSummaryParams(
  filters: ExpenseListFilters
): Record<string, string | number> {
  const tz = filters.timezone ?? getClientTimezone();
  const params: Record<string, string | number> = {
    restaurant_id: filters.restaurantId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    timezone: tz,
  };

  const station = resolveStationParam(filters.station ?? "all");
  if (station) params.station = station;

  if (filters.categoryId !== undefined) {
    params.category_id = filters.categoryId;
  }

  const businessLine = resolveBusinessLineParam(filters.businessLine ?? "all");
  if (businessLine) params.business_line = businessLine;

  return params;
}

function buildListParams(
  filters: ExpenseListFilters,
  skip: number,
  limit: number
): Record<string, string | number> {
  return {
    ...buildSummaryParams(filters),
    skip,
    limit,
  };
}

export async function fetchExpenseSummaryTotal(
  client: AxiosInstance,
  filters: ExpenseListFilters
): Promise<ExpenseSummaryTotal | null> {
  const res = await client.get(ExpenseApis.summaryTotal, {
    params: buildSummaryParams(filters),
  });
  if (res.data?.status !== "success") return null;
  const data = res.data.data ?? {};
  return {
    total_amount: Number(data.total_amount ?? 0),
    total_count: Number(data.total_count ?? 0),
  };
}

export async function fetchExpenseListPage(
  client: AxiosInstance,
  filters: ExpenseListFilters,
  skip: number,
  limit: number
): Promise<{ expenses: unknown[]; total: number }> {
  const res = await client.get(ExpenseApis.list, {
    params: buildListParams(filters, skip, limit),
  });
  if (res.data?.status !== "success") {
    return { expenses: [], total: 0 };
  }
  const data = res.data.data ?? {};
  return {
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    total: Number(data.total_count ?? data.total ?? 0),
  };
}

/** Loads every expense row for filters (paginated API), for payment-method breakdown only. */
export async function fetchAllExpensesForFilters(
  client: AxiosInstance,
  filters: ExpenseListFilters,
  knownTotalCount?: number
): Promise<unknown[]> {
  const expected =
    knownTotalCount ??
    (await fetchExpenseSummaryTotal(client, filters))?.total_count ??
    0;
  if (expected === 0) return [];

  const all: unknown[] = [];
  let skip = 0;

  while (skip < expected) {
    const { expenses, total } = await fetchExpenseListPage(
      client,
      filters,
      skip,
      EXPENSE_PAGE_LIMIT
    );
    if (!expenses.length) break;
    all.push(...expenses);
    skip += expenses.length;
    const bound = total > 0 ? total : expected;
    if (skip >= bound) break;
  }

  return all;
}
