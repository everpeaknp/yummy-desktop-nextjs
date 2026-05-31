"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSidebarItems } from "@/hooks/use-sidebar-items";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Users, CreditCard, ClipboardList, UserCircle, Package, 
    TrendingUp, TrendingDown, Settings2, FileText, History, 
    Armchair, Calendar, Receipt, UtensilsCrossed, LayoutGrid, 
    Percent, LineChart, Truck, ShoppingCart, Clock, Store, 
    Settings, Shield, QrCode, ShieldCheck, Monitor, Languages,
    Image as ImageIcon, ImagePlus, Printer, FileEdit, Volume2,
    Bell, Mail, Download, Database, UserCheck, Building2, KeyRound
} from "lucide-react";

// Same sections as in manage/page.tsx for a unified search experience
const MANAGE_ITEMS = [
    { title: "Tables", href: "/tables", icon: Armchair, section: "Manage / Core Operations" },
    { title: "Reservations", href: "/reservations", icon: Calendar, section: "Manage / Core Operations" },
    { title: "Receipts", href: "/receipts", icon: Receipt, section: "Manage / Core Operations" },
    { title: "Menu Items", href: "/menu/items", icon: UtensilsCrossed, section: "Manage / Menu & Offers" },
    { title: "Menu Categories", href: "/menu/categories", icon: LayoutGrid, section: "Manage / Menu & Offers" },
    { title: "Menu Modifiers", href: "/menu/modifiers", icon: Settings2, section: "Manage / Menu & Offers" },
    { title: "Discounts", href: "/discounts", icon: Percent, section: "Manage / Menu & Offers" },
    { title: "Income", href: "/finance/income", icon: TrendingUp, section: "Manage / Finance & Insights" },
    { title: "Expenses", href: "/finance/expenses", icon: TrendingDown, section: "Manage / Finance & Insights" },
    { title: "Analytics", href: "/analytics", icon: LineChart, section: "Manage / Finance & Insights" },
    { title: "Awaiting Payments", href: "/manage/awaiting-payments", icon: Clock, section: "Manage / Finance & Insights" },
    { title: "Staff Management", href: "/staff", icon: Users, section: "Manage / Administration" },
    { title: "Custom Roles", href: "/manage/roles", icon: Shield, section: "Manage / Administration" },
    { title: "Payroll", href: "/payroll", icon: UserCircle, section: "Manage / Administration" },
    { title: "Period Reports", href: "/period-reports", icon: ClipboardList, section: "Manage / Administration" },
    { title: "Customers", href: "/customers", icon: CreditCard, section: "Manage / Administration" },
    { title: "Suppliers", href: "/manage/suppliers", icon: Truck, section: "Manage / Administration" },
    { title: "General Purchases", href: "/manage/purchases", icon: ShoppingCart, section: "Manage / Administration" },
    { title: "Inventory", href: "/inventory", icon: Package, section: "Manage / System Settings" },
    { title: "Audit Logs", href: "/manage/audit-logs", icon: History, section: "Manage / System Settings" },
    { title: "Taxes & Fees", href: "/manage/taxes", icon: FileText, section: "Manage / System Settings" },
    { title: "Restaurant Profile", href: "/manage/profile", icon: Store, section: "Manage / System Settings" },
    { title: "Restaurant Settings", href: "/manage/settings", icon: Settings, section: "Manage / System Settings" },
    { title: "Additional Settings", href: "/manage/additional-settings", icon: LayoutGrid, section: "Manage / System Settings" },

    // Restaurant Settings Sub-items
    { title: "FonePay Integration", href: "/manage/settings?tab=payments", icon: CreditCard, section: "Settings / Payments & POS" },
    { title: "Static QR Manager", href: "/manage/settings?tab=payments", icon: QrCode, section: "Settings / Payments & POS" },
    { title: "Global Operational Settings (Tax, KOT)", href: "/manage/settings?tab=advanced", icon: ShieldCheck, section: "Settings / Advanced" },

    // Additional Settings Sub-items
    { title: "Appearance (Theme Mode)", href: "/manage/additional-settings?setting=appearance", icon: Monitor, section: "Additional Settings / Dashboard" },
    { title: "Language", href: "/manage/additional-settings?setting=language", icon: Languages, section: "Additional Settings / Dashboard" },
    { title: "Branding (Logo & Cover)", href: "/manage/additional-settings?setting=branding", icon: ImageIcon, section: "Additional Settings / Branding" },
    { title: "Menu Gallery", href: "/manage/additional-settings?setting=gallery_management", icon: ImagePlus, section: "Additional Settings / Branding" },
    { title: "Printer Management", href: "/manage/additional-settings?setting=printer_management", icon: Printer, section: "Additional Settings / Hardware" },
    { title: "Receipt Designer", href: "/manage/receipt-designer", icon: Receipt, section: "Additional Settings / Hardware" },
    { title: "KOT Designer", href: "/manage/kot-designer", icon: FileEdit, section: "Additional Settings / Hardware" },
    { title: "Kitchen Sounds", href: "/manage/additional-settings?setting=kitchen_sounds", icon: Volume2, section: "Additional Settings / Hardware" },
    { title: "Push Alerts", href: "/manage/additional-settings?setting=push_alerts", icon: Bell, section: "Additional Settings / Notifications" },
    { title: "Email Summaries", href: "/manage/additional-settings?setting=email_summaries", icon: Mail, section: "Additional Settings / Notifications" },
    { title: "KOT Notifications", href: "/manage/additional-settings?setting=kot_notifications", icon: ClipboardList, section: "Additional Settings / Notifications" },
    { title: "Order Notifications", href: "/manage/additional-settings?setting=order_notifications", icon: Bell, section: "Additional Settings / Notifications" },
    { title: "Tax Configuration", href: "/manage/additional-settings?setting=tax_configuration", icon: Percent, section: "Additional Settings / Finance" },
    { title: "Enable Tax", href: "/manage/additional-settings?setting=tax_toggle", icon: ShieldCheck, section: "Additional Settings / Finance" },
    { title: "Data Export", href: "/manage/additional-settings?setting=data_export", icon: Download, section: "Additional Settings / Finance" },
    { title: "Auto Backup", href: "/manage/additional-settings?setting=auto_backup", icon: Database, section: "Additional Settings / Finance" },
    { title: "Admin Management", href: "/manage/additional-settings?setting=admin_management", icon: UserCheck, section: "Additional Settings / Security" },
    { title: "Switch Restaurant", href: "/manage/additional-settings?setting=switch_restaurant", icon: Building2, section: "Additional Settings / Security" },
    { title: "Change Password", href: "/manage/additional-settings?setting=change_password", icon: KeyRound, section: "Additional Settings / Security" },
];

interface GlobalSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
    const [query, setQuery] = useState("");
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const canViewAnalytics = hasPermission(user, "reports.analytics.view");
    const sidebarItems = useSidebarItems();

    // Reset query when closed
    useEffect(() => {
        if (!open) {
            setQuery("");
        }
    }, [open]);

    const allItems = useMemo(() => {
        const items = new Map();

        sidebarItems.forEach((item) => {
            if (item.href === "/analytics" && !canViewAnalytics) return;
            items.set(item.href, { ...item, section: item.section || "Main Menu" });
        });

        MANAGE_ITEMS.forEach((item) => {
            if (item.href === "/analytics" && !canViewAnalytics) return;
            if (!items.has(item.href)) {
                items.set(item.href, item);
            }
        });

        return Array.from(items.values());
    }, [sidebarItems, canViewAnalytics]);

    const filteredItems = useMemo(() => {
        if (!query.trim()) return allItems;
        const lowerQuery = query.toLowerCase();
        return allItems.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) || 
            (item.section && item.section.toLowerCase().includes(lowerQuery))
        );
    }, [query, allItems]);

    const handleSelect = (href: string) => {
        onOpenChange(false);
        router.push(href);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 sm:max-w-xl gap-0 overflow-hidden rounded-xl border-border bg-card shadow-2xl">
                <div className="flex items-center px-4 py-3 border-b bg-muted/40">
                    <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
                    <input 
                        className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-base placeholder:text-muted-foreground/70"
                        placeholder="Search for pages, settings, features..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="hidden sm:flex text-[10px] bg-muted px-2 py-0.5 rounded border text-muted-foreground font-medium shrink-0 ml-2">
                        ESC to close
                    </div>
                </div>

                <ScrollArea className="max-h-[60vh] overflow-y-auto">
                    {filteredItems.length === 0 ? (
                        <div className="py-14 text-center text-sm text-muted-foreground">
                            No results found for &quot;{query}&quot;
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.href}
                                    onClick={() => handleSelect(item.href)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-primary/10 hover:text-primary transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-foreground group-hover:text-primary">{item.title}</div>
                                        <div className="text-[11px] text-muted-foreground">{item.section}</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
