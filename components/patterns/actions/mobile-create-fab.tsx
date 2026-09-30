"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { shouldMobileBottomNavBeVisible } from "@/lib/mobile-module-navigation";
import { cn } from "@/lib/utils";

export interface MobileCreateFabProps {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function MobileCreateFab({
  label,
  href,
  onClick,
  className,
}: MobileCreateFabProps) {
  const pathname = usePathname() || "/";
  const hasBottomNavigation = shouldMobileBottomNavBeVisible(pathname);
  const actionClassName = cn(
    "flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25",
    "transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  );
  const content = <Plus aria-hidden="true" className="h-6 w-6" />;

  return (
    <>
      <div aria-hidden="true" className="h-20 lg:hidden" />
      <div
        data-mobile-create-fab
        className={cn(
          "fixed right-4 z-30 lg:hidden",
          hasBottomNavigation
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {href ? (
          <Link href={href} aria-label={label} className={actionClassName}>
            {content}
          </Link>
        ) : (
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={actionClassName}
          >
            {content}
          </button>
        )}
      </div>
    </>
  );
}
