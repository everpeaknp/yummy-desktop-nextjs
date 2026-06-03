"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { orderIdFromTransactionId } from "@/lib/transactions";

export default function TransactionRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as { id?: string })?.id || "");

  useEffect(() => {
    if (!id) {
      router.replace("/transactions");
      return;
    }

    const orderId = orderIdFromTransactionId(id);
    if (orderId !== null) {
      router.replace(`/orders/${orderId}`);
      return;
    }

    router.replace(`/transactions?tx=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="h-[60vh] flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
    </div>
  );
}
