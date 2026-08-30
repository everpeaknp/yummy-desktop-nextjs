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
    <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1" aria-label="Workspace views">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
        <Link href={action.href} className="inline-flex items-center text-sm font-medium text-primary hover:underline">
          {action.label}<ArrowUpRight className="ml-1 h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
