"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import POSSystem from "@/components/orders/pos-system";

export default function AddItemsPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <POSSystem orderId={params.id} />
    </Suspense>
  );
}
