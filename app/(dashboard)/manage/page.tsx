"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
    Users,
    CreditCard,
    ClipboardList,
    UserCircle,
    Package,
    TrendingUp,
    TrendingDown,
    Settings2,
    FileText,
    History,
    Armchair,
    Calendar,
    Receipt,
    UtensilsCrossed,
    LayoutGrid,
    Percent,
    LineChart,
    ChevronRight,
    Truck,
    ShoppingCart,
    Clock,
    Store,
    Settings,
    Shield,
    Fingerprint,
    HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCenterDialog } from "@/components/onboarding/help-center-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { isPathAccessible } from "@/lib/role-permissions";

type ManageItem = {
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    accessHref?: string;
    action?: "help";
};

const sections: Array<{ title: string; items: ManageItem[] }> = [
    {
        title: "CORE OPERATIONS",
        items: [
            {
                title: "Tables",
                description: "Floor & occupancy",
                href: "/tables",
                icon: Armchair,
                iconColor: "text-blue-500",
                iconBg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
                title: "Reservations",
                description: "Bookings & guests",
                href: "/reservations",
                icon: Calendar,
                iconColor: "text-purple-500",
                iconBg: "bg-purple-50 dark:bg-purple-900/20",
            },
            {
                title: "Receipts",
                description: "Past transactions",
                href: "/receipts",
                icon: Receipt,
                iconColor: "text-slate-500",
                iconBg: "bg-slate-50 dark:bg-slate-900/20",
            },
        ],
    },
    {
        title: "MENU & OFFERS",
        items: [
            {
                title: "Menu",
                description: "Items & prices",
                href: "/menu/items",
                icon: UtensilsCrossed,
                iconColor: "text-orange-500",
                iconBg: "bg-orange-50 dark:bg-orange-900/20",
            },
            {
                title: "Categories",
                description: "Organize items",
                href: "/menu/categories",
                icon: LayoutGrid,
                iconColor: "text-amber-500",
                iconBg: "bg-amber-50 dark:bg-amber-900/20",
            },
            {
                title: "Modifiers",
                description: "Add-ons & sides",
                href: "/menu/modifiers",
                icon: Settings2,
                iconColor: "text-emerald-500",
                iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
                title: "Discounts",
                description: "Promos & coupons",
                href: "/discounts",
                icon: Percent,
                iconColor: "text-rose-500",
                iconBg: "bg-rose-50 dark:bg-rose-900/20",
            },
        ],
    },
    {
        title: "FINANCE & INSIGHTS",
        items: [
            {
                title: "Income",
                description: "Sales revenue",
                href: "/finance/income",
                icon: TrendingUp,
                iconColor: "text-emerald-600",
                iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
                title: "Expenses",
                description: "Cost tracking",
                href: "/finance/expenses",
                icon: TrendingDown,
                iconColor: "text-rose-600",
                iconBg: "bg-rose-50 dark:bg-rose-900/20",
            },
            {
                title: "Analytics",
                description: "Trends & insights",
                href: "/analytics",
                icon: LineChart,
                iconColor: "text-indigo-500",
                iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
            },
            {
                title: "Awaiting Payments",
                description: "Pending supplier bills",
                href: "/manage/awaiting-payments",
                icon: Clock,
                iconColor: "text-amber-600",
                iconBg: "bg-amber-50 dark:bg-amber-900/20",
            },
        ],
    },
    {
        title: "ADMINISTRATION",
        items: [
            {
                title: "Staff Management",
                description: "Employees & roles",
                href: "/staff",
                icon: Users,
                iconColor: "text-blue-600",
                iconBg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
                title: "Custom Roles",
                description: "Permissions & access",
                href: "/manage/roles",
                icon: Shield,
                iconColor: "text-rose-600",
                iconBg: "bg-rose-50 dark:bg-rose-900/20",
            },
            {
                title: "Payroll",
                description: "Salary & payments",
                href: "/payroll",
                icon: UserCircle,
                iconColor: "text-purple-600",
                iconBg: "bg-purple-50 dark:bg-purple-900/20",
            },
            {
                title: "Attendance",
                description: "QR & devices",
                href: "/attendance",
                icon: Fingerprint,
                iconColor: "text-teal-600",
                iconBg: "bg-teal-50 dark:bg-teal-900/20",
            },
            {
                title: "Period Reports",
                description: "Weekly/Monthly close",
                href: "/period-reports",
                icon: ClipboardList,
                iconColor: "text-orange-600",
                iconBg: "bg-orange-50 dark:bg-orange-900/20",
            },
            {
                title: "Customers",
                description: "Points & credit",
                href: "/customers",
                icon: CreditCard,
                iconColor: "text-emerald-600",
                iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
                title: "Suppliers",
                description: "Vendor directory",
                href: "/manage/suppliers",
                icon: Truck,
                iconColor: "text-blue-500",
                iconBg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
                title: "General Purchases",
                description: "Equipment & supplies",
                href: "/manage/purchases",
                icon: ShoppingCart,
                iconColor: "text-violet-500",
                iconBg: "bg-violet-50 dark:bg-violet-900/20",
            },
        ],
    },
    {
        title: "SYSTEM SETTINGS",
        items: [
            {
                title: "Inventory",
                description: "Stock & suppliers",
                href: "/inventory",
                icon: Package,
                iconColor: "text-amber-600",
                iconBg: "bg-amber-50 dark:bg-amber-900/20",
            },
            {
                title: "Audit Logs",
                description: "System activity",
                href: "/manage/audit-logs",
                icon: History,
                iconColor: "text-slate-600",
                iconBg: "bg-slate-50 dark:bg-slate-900/20",
            },
            {
                title: "Taxes & Fees",
                description: "VAT & charges",
                href: "/manage/taxes",
                icon: FileText,
                iconColor: "text-cyan-600",
                iconBg: "bg-cyan-50 dark:bg-cyan-900/20",
            },
            {
                title: "Restaurant Profile",
                description: "Identity & Branding",
                href: "/manage/profile",
                icon: Store,
                iconColor: "text-rose-500",
                iconBg: "bg-rose-50 dark:bg-rose-900/20",
            },
            {
                title: "Restaurant Settings",
                description: "Operational setup",
                href: "/manage/settings",
                icon: Settings,
                iconColor: "text-slate-700",
                iconBg: "bg-slate-100 dark:bg-slate-800/50",
            },
            {
                title: "Additional Settings",
                description: "Advanced configuration",
                href: "/manage/additional-settings",
                icon: LayoutGrid,
                iconColor: "text-slate-600",
                iconBg: "bg-slate-200 dark:bg-slate-800/80",
            },
            {
                title: "Help",
                description: "Tour, onboarding & resources",
                href: "#help",
                icon: HelpCircle,
                iconColor: "text-teal-600",
                iconBg: "bg-teal-50 dark:bg-teal-900/20",
                accessHref: "/manage",
                action: "help",
            },
        ],
    },
];

export default function ManagePage() {
    const user = useAuth((s) => s.user);
    const [helpOpen, setHelpOpen] = useState(false);

    const visibleSections = useMemo(
        () =>
            sections
                .map((section) => ({
                    ...section,
                    items: section.items.filter((item) =>
                        isPathAccessible(item.accessHref ?? item.href, user)
                    ),
                }))
                .filter((section) => section.items.length > 0),
        [user?.permissions, user?.role, user?.roles, user?.primary_role]
    );

    return (
        <div className="mx-auto max-w-[1600px] space-y-12 p-8 pb-24">
            <div className="space-y-1">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Settings</h1>
                <p className="font-medium text-muted-foreground">
                    Configure your operations, menu, and financial settings.
                </p>
            </div>

            <div className="space-y-12">
                {visibleSections.map((section) => (
                    <div key={section.title} className="space-y-5">
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                            {section.title}
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {section.items.map((item) => {
                                const card = (
                                    <Card className="group h-[90px] cursor-pointer overflow-hidden border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-md">
                                        <CardContent className="flex h-full items-center gap-4 p-4">
                                            <div
                                                className={cn(
                                                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                                                    item.iconBg,
                                                    item.iconColor
                                                )}
                                            >
                                                <item.icon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="mb-0.5 truncate text-[14px] font-bold transition-colors group-hover:text-primary">
                                                    {item.title}
                                                </h3>
                                                <p className="truncate text-[11px] font-medium text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/20 transition-colors group-hover:text-primary" />
                                        </CardContent>
                                    </Card>
                                );

                                if (item.action === "help") {
                                    return (
                                        <button
                                            key={item.href}
                                            type="button"
                                            className="w-full text-left"
                                            onClick={() => setHelpOpen(true)}
                                        >
                                            {card}
                                        </button>
                                    );
                                }

                                return (
                                    <Link key={item.href} href={item.href}>
                                        {card}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <HelpCenterDialog
                open={helpOpen}
                onOpenChange={setHelpOpen}
                includeOnboarding
            />
        </div>
    );
}
