"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceLink = { label: string; href: string };

export function FinanceWorkspaceNav({
  links,
  action,
}: {
  links: WorkspaceLink[];
  action?: WorkspaceLink;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
      <nav
        className="grid min-h-11 w-full min-w-0 gap-1 rounded-xl bg-muted/70 p-1 sm:w-auto"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        aria-label="Workspace views"
      >
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-9 min-w-0 items-center justify-center truncate whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors sm:text-sm",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {action ? (
        <Link href={action.href} className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline sm:self-auto">
          {action.label}<ArrowUpRight className="ml-1 h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
