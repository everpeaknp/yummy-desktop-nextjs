type ApprovalOrder = { id: number; status: string; approval_target_order_id?: number | null };

/** Never hide a request unless its authoritative target bill is present. */
export function groupOrderApprovals<T extends ApprovalOrder>(orders: T[]) {
  const acceptedIds = new Set(orders.filter(order => ["pending", "preparing", "ready", "running", "scheduled"].includes(order.status)).map(order => order.id));
  const additions = new Map<number, T[]>();
  const visible = orders.filter(order => {
    if (order.status !== "requested" || !order.approval_target_order_id || !acceptedIds.has(order.approval_target_order_id)) return true;
    additions.set(order.approval_target_order_id, [...(additions.get(order.approval_target_order_id) || []), order]);
    return false;
  });
  return { visible, additions };
}
