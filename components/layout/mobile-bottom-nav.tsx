"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSidebarItems, type SidebarItem } from "@/hooks/use-sidebar-items";
import { cn } from "@/lib/utils";

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function MoreLink({ item, onNavigate }: { item: SidebarItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname() || "/dashboard";
  const items = useSidebarItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const home = items.find((item) => item.href === "/dashboard" || item.href === "/hotel") || items[0];
  const orders = items.find((item) => item.href === "/orders");
  const analytics = items.find((item) => item.href === "/analytics");
  const finance = items.find((item) => item.title === "Finance") || items.find((item) => item.href === "/finance");
  const primaryItems = [home, orders, analytics || finance].filter((item): item is SidebarItem => Boolean(item));
  const primaryHrefs = new Set([...primaryItems.map((item) => item.href), "/manage/profile"]);

  return (
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors", isActive(pathname, item.href) ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
        <Link href="/manage/profile" className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors", isActive(pathname, "/manage/profile") ? "text-primary" : "text-muted-foreground")}>
          <UserRound className="h-5 w-5" />
          <span>Profile</span>
        </Link>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild><Button variant="ghost" className="min-h-14 h-auto flex-col gap-1 rounded-xl px-1 text-[10px] font-medium text-muted-foreground"><MoreHorizontal className="h-5 w-5" />More</Button></SheetTrigger>
          <SheetContent side="bottom" className="flex h-[82dvh] max-h-[82vh] flex-col overflow-hidden rounded-t-2xl p-0">
            <SheetHeader className="shrink-0 border-b px-5 py-4 text-left"><SheetTitle>More</SheetTitle></SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-8">
              {items.filter((item) => !primaryHrefs.has(item.href)).map((item) => (
                <div key={item.href} className="mb-3 last:mb-0">
                  {item.subItems?.length ? (
                    <button type="button" onClick={() => setExpandedGroup((current) => current === item.href ? null : item.href)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><item.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedGroup === item.href && "rotate-180")} />
                    </button>
                  ) : <MoreLink item={item} onNavigate={() => setMoreOpen(false)} />}
                  {item.subItems?.length && expandedGroup === item.href ? <div className="ml-5 border-l border-border pl-2">{item.subItems.map((child) => <MoreLink key={child.href} item={child} onNavigate={() => setMoreOpen(false)} />)}</div> : null}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
