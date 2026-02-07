"use client";

import { Suspense } from "react";
import POSSystem from "@/components/orders/pos-system";

export default function EditOrderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <POSSystem orderId={params.id} />
    </Suspense>
  );
}
