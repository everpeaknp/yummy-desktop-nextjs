"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, Receipt, CalendarRange, Settings, Truck, Users, LayoutGrid, Pizza, AlertCircle, Percent, DollarSign, Activity } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const items = [
  {
    category: "Core Operations",
    items: [
      {
        title: "Tables",
        description: "Floor & occupancy",
        icon: LayoutGrid,
        href: "/tables",
        color: "text-blue-500",
        bg: "bg-blue-100 dark:bg-blue-900/20"
      },
      {
        title: "Reservations",
        description: "Bookings & guests",
        icon: CalendarRange,
        href: "/reservations",
        color: "text-purple-500",
        bg: "bg-purple-100 dark:bg-purple-900/20"
      },
      {
        title: "Receipts",
        description: "Past transactions",
        icon: Receipt,
        href: "/receipts",
        color: "text-slate-500",
        bg: "bg-slate-100 dark:bg-slate-900/20"
      },
    ]
  },
  {
    category: "Menu & Offers",
    items: [
      {
        title: "Menu",
        description: "Items & prices",
        icon: Utensils,
        href: "/menu/items",
        color: "text-orange-500",
        bg: "bg-orange-100 dark:bg-orange-900/20"
      },
      {
        title: "Categories",
        description: "Organize items",
        icon: Pizza,
        href: "/menu/categories",
        color: "text-yellow-500",
        bg: "bg-yellow-100 dark:bg-yellow-900/20"
      },
      {
        title: "Modifiers",
        description: "Add-ons & sides",
        icon: Settings,
        href: "/menu/modifiers",
        color: "text-cyan-500",
        bg: "bg-cyan-100 dark:bg-cyan-900/20"
      },
      {
        title: "Discounts",
        description: "Promos & coupons",
        icon: Percent,
        href: "/discounts",
        color: "text-pink-500",
        bg: "bg-pink-100 dark:bg-pink-900/20"
      }
    ]
  },
  {
    category: "Finance & Insights",
    items: [
      {
        title: "Income",
        description: "Sales revenue",
        icon: DollarSign,
        href: "/finance/income",
        color: "text-emerald-500",
        bg: "bg-emerald-100 dark:bg-emerald-900/20"
      },
      {
        title: "Expenses",
        description: "Cost tracking",
        icon: Activity,
        href: "/finance/expenses",
        color: "text-red-500",
        bg: "bg-red-100 dark:bg-red-900/20"
      },
      {
        title: "Analytics",
        description: "Trends & insights",
        icon: Activity,
        href: "/analytics",
        color: "text-indigo-500",
        bg: "bg-indigo-100 dark:bg-indigo-900/20"
      },
    ]
  }
];

export default function ManagePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your operations, menu, and financial settings.</p>
      </div>

      <div className="flex flex-col gap-8">
        {items.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
              {section.category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {section.items.map((item, itemIdx) => (
                <Link 
                  href={item.href} 
                  key={itemIdx}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onClick={() => sessionStorage.setItem('fromManage', 'true')}
                >

                  <Card className="hover:shadow-md transition-all cursor-pointer border-l-4 hover:scale-[1.02] group" style={{ borderLeftColor: item.color.replace('text-', '') }}>
                    <CardHeader className="flex flex-row items-center gap-4 p-4">
                      <div className={cn("p-2 rounded-lg transition-colors group-hover:bg-opacity-80", item.bg)}>
                        <item.icon className={cn("h-5 w-5", item.color)} />
                      </div>
                      <div className="flex flex-col">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="text-xs">{item.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
