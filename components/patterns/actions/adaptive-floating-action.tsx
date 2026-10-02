"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface AdaptiveFloatingActionProps {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  compactLabel?: string;
  scrollThreshold?: number;
  scrollContainerSelector?: string;
  className?: string;
  mobileOnly?: boolean;
  placement?: "fixed" | "contained";
}

export function AdaptiveFloatingAction({
  label,
  compactLabel,
  icon,
  href,
  onClick,
  scrollThreshold = 72,
  scrollContainerSelector = "main",
  className,
  mobileOnly = true,
  placement = "fixed",
}: AdaptiveFloatingActionProps) {
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const scrollContainer = document.querySelector(scrollContainerSelector);
    const update = () => setCompact((scrollContainer?.scrollTop || window.scrollY) > scrollThreshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    scrollContainer?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      scrollContainer?.removeEventListener("scroll", update);
    };
  }, [scrollContainerSelector, scrollThreshold]);

  const actionClassName = cn(
    "pointer-events-auto flex h-12 items-center justify-center overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/25",
    "transition-[width,border-radius,box-shadow] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
    compact ? "w-12 rounded-full" : "w-full rounded-2xl",
    className
  );
  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className={cn("overflow-hidden whitespace-nowrap text-sm font-semibold transition-[width,margin,opacity] duration-300 motion-reduce:transition-none", compact ? "ml-0 w-0 opacity-0" : "ml-2 w-auto opacity-100")}>
        {label}
      </span>
    </>
  );
  const ariaLabel = compact ? compactLabel ?? label : label;

  return (
    <div className={cn(
      "pointer-events-none inset-x-4 z-30 flex justify-end",
      placement === "fixed" ? "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "absolute bottom-4",
      mobileOnly && placement === "fixed" && "md:hidden"
    )}>
      {href ? (
        <Link href={href} aria-label={ariaLabel} className={actionClassName}>{content}</Link>
      ) : (
        <button type="button" aria-label={ariaLabel} onClick={onClick} className={actionClassName}>{content}</button>
      )}
    </div>
  );
}
