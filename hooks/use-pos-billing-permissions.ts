"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

/** Mirrors backend `settings.CASHIER_REFUND_WINDOW_DAYS` default. */
export const CASHIER_REFUND_WINDOW_DAYS = 7;

export function isOrderRefundHistorical(orderCreatedAt?: string | null): boolean {
  if (!orderCreatedAt) return false;

  const created = new Date(orderCreatedAt);
  if (Number.isNaN(created.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const earliestAllowed = new Date(today);
  earliestAllowed.setDate(earliestAllowed.getDate() - (CASHIER_REFUND_WINDOW_DAYS - 1));

  const orderDate = new Date(created);
  orderDate.setHours(0, 0, 0, 0);

  return orderDate < earliestAllowed;
}

export function usePosBillingPermissions() {
  const user = useAuth((s) => s.user);

  return useMemo(() => {
    const can = (permission: PermissionKey) => hasPermission(user, permission);

    const canApplyDiscount = can("pos.order.discount.apply");
    const canVoidOrder = can("pos.order.void");
    const canVoidItem = can("pos.order.void_item");
    const canTransferOrder = can("pos.order.transfer");
    const canSplitBill = can("billing.bill.split");
    const canProcessPayment = can("billing.payment.process");
    const canEditPayment = can("billing.payment.edit");
    const canDeletePayment = can("billing.payment.delete");
    const canProcessRefund = can("billing.refund.process");
    const canApproveHistoricalRefund = can("billing.refund.approve");

    const canRefundOrder = (orderCreatedAt?: string | null) => {
      if (!canProcessRefund) return false;
      if (isOrderRefundHistorical(orderCreatedAt)) {
        return canApproveHistoricalRefund;
      }
      return true;
    };

    return {
      canApplyDiscount,
      canVoidOrder,
      canVoidItem,
      canTransferOrder,
      canSplitBill,
      canProcessPayment,
      canEditPayment,
      canDeletePayment,
      canProcessRefund,
      canApproveHistoricalRefund,
      canRefundOrder,
    };
  }, [user]);
}
