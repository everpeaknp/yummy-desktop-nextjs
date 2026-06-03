"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function TransactionRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  useEffect(() => {
    if (!id) {
      router.replace("/transactions");
      return;
    }
    router.replace(`/transactions?tx=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="h-[60vh] flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading transaction…
    </div>
  );
}

