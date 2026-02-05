"use client";

import POSSystem from "@/components/orders/pos-system";

export default function EditOrderPage({ params }: { params: { id: string } }) {
  return <POSSystem orderId={params.id} />;
}
