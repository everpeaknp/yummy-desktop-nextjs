import { expect, it } from "vitest";
import { groupOrderApprovals } from "./order-approval-groups";
it("groups additions under the server-selected customer bill without changing amounts", () => {
  const orders = [{ id: 1, status: "pending", grand_total: 100 }, { id: 2, status: "requested", approval_target_order_id: 1, grand_total: 20 }, { id: 3, status: "pending", grand_total: 40 }, { id: 4, status: "requested", approval_target_order_id: 3, grand_total: 10 }];
  const grouped = groupOrderApprovals(orders);
  expect(grouped.visible.map(order => order.id)).toEqual([1, 3]);
  expect(grouped.additions.get(1)?.map(order => order.id)).toEqual([2]);
  expect(grouped.additions.get(3)?.map(order => order.id)).toEqual([4]);
  expect(orders[0].grand_total).toBe(100);
});
it("does not hide first requests, filtered-out targets, or stale closed targets", () => {
  const orders = [{ id: 1, status: "completed" }, { id: 2, status: "requested", approval_target_order_id: 1 }, { id: 3, status: "requested", approval_target_order_id: 99 }, { id: 4, status: "requested" }];
  expect(groupOrderApprovals(orders).visible).toEqual(orders);
});
