"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import POSSystem from "@/components/orders/pos-system";

export default function EditOrderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <POSSystem orderId={params.id} />
    </Suspense>
  );
}
