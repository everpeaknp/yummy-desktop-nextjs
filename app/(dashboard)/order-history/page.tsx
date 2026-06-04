"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Legacy Flutter route alias → `/orders/history`. */
export default function OrderHistoryAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/orders/history");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
