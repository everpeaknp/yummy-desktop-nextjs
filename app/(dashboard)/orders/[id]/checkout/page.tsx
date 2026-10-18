"use client";

import { useParams } from "next/navigation";
import { OrderCheckoutWorkspace } from "@/components/orders/order-checkout-workspace";

export default function CheckoutPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const orderId = Number(rawId || 0);

  return (
    <OrderCheckoutWorkspace
      key={orderId}
      orderId={orderId}
      presentation="page"
    />
  );
}
