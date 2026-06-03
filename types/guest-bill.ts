export interface GuestBillSessionOrder {
  order_id: number;
  split_label?: string | null;
  split_sequence?: number | null;
  status: string;
  items_count: number;
  grand_total: number;
  total_paid: number;
  balance_due: number;
  is_fully_paid: boolean;
  table_id?: number | null;
}

export interface GuestBillSession {
  anchor_order_id: number;
  split_group_id?: string | null;
  context_order_ids: number[];
  orders: GuestBillSessionOrder[];
}

export interface SplitBillLineInput {
  order_item_id: number;
  qty: number;
}

export interface SplitBillPartInput {
  label: string;
  lines: SplitBillLineInput[];
}

export interface SplitBillChildSummary {
  order_id: number;
  split_label?: string | null;
  split_sequence?: number | null;
  grand_total: number;
  total_paid: number;
  balance_due: number;
  status: string;
}

export interface SplitBillResult {
  parent_order_id: number;
  split_group_id: string;
  children: SplitBillChildSummary[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseGuestBillSession(payload: unknown): GuestBillSession | null {
  const data = asRecord(payload);
  if (!data) return null;
  const ordersRaw = Array.isArray(data.orders) ? data.orders : [];
  const orders: GuestBillSessionOrder[] = [];
  for (const row of ordersRaw) {
    const o = asRecord(row);
    if (!o || typeof o.order_id !== "number") continue;
    orders.push({
      order_id: o.order_id,
      split_label: o.split_label != null ? String(o.split_label) : null,
      split_sequence: typeof o.split_sequence === "number" ? o.split_sequence : null,
      status: String(o.status ?? ""),
      items_count: typeof o.items_count === "number" ? o.items_count : 0,
      grand_total: Number(o.grand_total ?? 0),
      total_paid: Number(o.total_paid ?? 0),
      balance_due: Number(o.balance_due ?? 0),
      is_fully_paid: Boolean(o.is_fully_paid),
      table_id: typeof o.table_id === "number" ? o.table_id : null,
    });
  }

  return {
    anchor_order_id: Number(data.anchor_order_id),
    split_group_id: data.split_group_id != null ? String(data.split_group_id) : null,
    context_order_ids: Array.isArray(data.context_order_ids)
      ? data.context_order_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
    orders,
  };
}

export function parseSplitBillResult(payload: unknown): SplitBillResult | null {
  const data = asRecord(payload);
  if (!data) return null;
  const childrenRaw = Array.isArray(data.children) ? data.children : [];
  return {
    parent_order_id: Number(data.parent_order_id),
    split_group_id: String(data.split_group_id ?? ""),
    children: (() => {
      const children: SplitBillChildSummary[] = [];
      for (const row of childrenRaw) {
        const c = asRecord(row);
        if (!c || typeof c.order_id !== "number") continue;
        children.push({
          order_id: c.order_id,
          split_label: c.split_label != null ? String(c.split_label) : null,
          split_sequence: typeof c.split_sequence === "number" ? c.split_sequence : null,
          grand_total: Number(c.grand_total ?? 0),
          total_paid: Number(c.total_paid ?? 0),
          balance_due: Number(c.balance_due ?? 0),
          status: String(c.status ?? ""),
        });
      }
      return children;
    })(),
  };
}
