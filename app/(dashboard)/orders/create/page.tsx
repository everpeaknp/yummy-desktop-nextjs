"use client";

import { Suspense } from "react";
import POSSystem from "@/components/orders/pos-system";

export default function CreateOrderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <POSSystem orderId="create" />
    </Suspense>
  );
}
