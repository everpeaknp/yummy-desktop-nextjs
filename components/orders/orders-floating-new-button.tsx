"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function OrdersFloatingNewButton() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    const update = () => setCompact((scrollContainer?.scrollTop || window.scrollY) > 72);
    update();
    window.addEventListener("scroll", update, { passive: true });
    scrollContainer?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      scrollContainer?.removeEventListener("scroll", update);
    };
  }, []);

  return <Link href="/orders/new" aria-label="Create a new order" className={cn("fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-12 w-[calc(100vw-2rem)] items-center justify-center bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-[width,transform,border-radius] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none md:hidden", compact ? "w-12 translate-x-[calc(100vw-5rem)] rounded-full" : "translate-x-0 rounded-2xl")}><Plus className="h-5 w-5 shrink-0" /><span className={cn("overflow-hidden whitespace-nowrap text-sm font-semibold transition-[width,margin,opacity] duration-300 ease-out", compact ? "ml-0 w-0 opacity-0" : "ml-2 w-auto opacity-100")}>New order</span></Link>;
}
