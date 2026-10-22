import {
  Bell,
  Building2,
  CreditCard,
  Download,
  FileEdit,
  History,
  ImageIcon,
  KeyRound,
  Landmark,
  LogOut,
  Monitor,
  Percent,
  Printer,
  Receipt,
  Settings2,
  ShieldCheck,
  Store,
  UserCheck,
  Volume2,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "@/lib/role-permissions";

export type SettingsCategoryId =
  | "business"
  | "finance"
  | "people"
  | "hardware"
  | "notifications"
  | "administration"
  | "billing"
  | "personal";

export type SettingsAvailabilityState = "available" | "unavailable" | "hidden";

export type SettingsNavigationItem = {
  id: string;
  title: string;
  description: string;
  category: SettingsCategoryId;
  route: string;
  icon: LucideIcon;
  permission: PermissionKey | null;
  entitlement: string | null;
  entitlementLegacyFallback?: boolean;
  searchTerms: string[];
  mobileBackTarget: string;
  availabilityState: SettingsAvailabilityState;
  surface: "route" | "inline";
};

export type SettingsCategory = {
  id: SettingsCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "business",
    title: "Business",
    description: "Identity, branding, and restaurant operations.",
    icon: Store,
  },
  {
    id: "finance",
    title: "Finance & payments",
    description: "Financial setup, tax, and payment providers.",
    icon: CreditCard,
  },
  {
    id: "people",
    title: "People & access",
    description: "Roles, permissions, administrators, and ownership.",
    icon: ShieldCheck,
  },
  {
    id: "hardware",
    title: "Hardware & documents",
    description: "Printers and document layouts.",
    icon: Printer,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Order alerts, KOT alerts, and this device.",
    icon: Bell,
  },
  {
    id: "administration",
    title: "Administration",
    description: "Audit history and business data exports.",
    icon: History,
  },
  {
    id: "billing",
    title: "Billing",
    description: "Subscription, usage, and available plans.",
    icon: Landmark,
  },
  {
    id: "personal",
    title: "Personal",
    description: "Your appearance, security, and restaurant membership.",
    icon: Monitor,
  },
];

export const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = [
  {
    id: "business_profile",
    title: "Business profile",
    description: "Restaurant identity, location, and business day",
    category: "business",
    route: "/settings/business-profile",
    icon: Store,
    permission: "settings.manage_restaurant",
    entitlement: null,
    searchTerms: [
      "restaurant",
      "address",
      "timezone",
      "logo",
      "cover",
      "branding",
      "PAN",
    ],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "restaurant_operations",
    title: "Restaurant operations",
    description: "POS and kitchen operational settings",
    category: "business",
    route: "/manage/settings?tab=advanced",
    icon: Settings2,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["KOT", "kitchen", "POS", "operations"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "finance_setup",
    title: "Finance setup",
    description: "Accounts, drawers, instruments, and controls",
    category: "finance",
    route: "/settings/finance",
    icon: Landmark,
    permission: "finance.income.view",
    entitlement: null,
    searchTerms: ["accounts", "drawers", "chart of accounts", "bank"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "tax_configuration",
    title: "Taxes & fees",
    description: "Tax calculation for new orders",
    category: "finance",
    route: "/settings/taxes",
    icon: Percent,
    permission: "settings.manage_restaurant",
    entitlement: null,
    searchTerms: ["VAT", "tax", "fee", "PAN"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "payment_integrations",
    title: "Payment integrations",
    description: "Payment provider and QR configuration",
    category: "finance",
    route: "/settings/payment-integrations",
    icon: CreditCard,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["FonePay", "QR", "card", "provider", "payment"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "roles",
    title: "Roles & permissions",
    description: "Access roles and permission rules",
    category: "people",
    route: "/settings/roles",
    icon: ShieldCheck,
    permission: "admin.roles.manage",
    entitlement: null,
    searchTerms: ["access", "role", "permission", "staff"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "admin_management",
    title: "Administrators",
    description: "Restaurant administrators and ownership",
    category: "people",
    route: "/settings/administrators",
    icon: UserCheck,
    permission: "admin.staff.manage",
    entitlement: null,
    searchTerms: ["admin", "owner", "invite", "access"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "printer_management",
    title: "Printers",
    description: "Printer hardware and station routing",
    category: "hardware",
    route: "/settings/printers",
    icon: Printer,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["printer", "USB", "network", "station", "receipt"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "receipt_designer",
    title: "Receipt designer",
    description: "Customize bill and receipt layouts",
    category: "hardware",
    route: "/settings/receipt-designer",
    icon: Receipt,
    permission: "admin.settings.manage",
    entitlement: "designers.receipt.enabled",
    entitlementLegacyFallback: true,
    searchTerms: ["receipt", "bill", "print", "template"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "kot_designer",
    title: "KOT designer",
    description: "Customize kitchen ticket layouts",
    category: "hardware",
    route: "/settings/kot-designer",
    icon: FileEdit,
    permission: "admin.settings.manage",
    entitlement: "designers.kot.enabled",
    entitlementLegacyFallback: true,
    searchTerms: ["KOT", "kitchen", "ticket", "print", "template"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "order_notifications",
    title: "Order notifications",
    description: "Alerts when new orders arrive",
    category: "notifications",
    route: "/settings?setting=order_notifications",
    icon: Bell,
    permission: null,
    entitlement: null,
    searchTerms: ["order", "alert", "notification"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "kot_notifications",
    title: "KOT notifications",
    description: "Kitchen ticket status alerts",
    category: "notifications",
    route: "/settings?setting=kot_notifications",
    icon: Bell,
    permission: null,
    entitlement: null,
    searchTerms: ["KOT", "kitchen", "ticket", "notification"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "device_preferences",
    title: "Device preferences",
    description: "Browser alerts and kitchen sounds",
    category: "notifications",
    route: "/settings?setting=device_preferences",
    icon: Volume2,
    permission: null,
    entitlement: null,
    searchTerms: ["sound", "browser", "push", "device", "alerts"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "audit_logs",
    title: "Audit logs",
    description: "Administrative and operational activity",
    category: "administration",
    route: "/manage/audit-logs",
    icon: History,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["history", "changes", "activity", "audit"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "data_export",
    title: "Data export",
    description: "Download business records and datasets",
    category: "administration",
    route: "/settings?setting=data_export",
    icon: Download,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["download", "CSV", "JSON", "backup", "data"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "billing",
    title: "Subscription",
    description: "Current plan, usage, and available plans",
    category: "billing",
    route: "/premium",
    icon: CreditCard,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["plan", "premium", "billing", "subscription", "usage"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme and visual preferences on this device",
    category: "personal",
    route: "/settings?setting=appearance",
    icon: Monitor,
    permission: null,
    entitlement: null,
    searchTerms: ["theme", "dark", "light", "system"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "change_password",
    title: "Password",
    description: "Update your login password",
    category: "personal",
    route: "/settings?setting=change_password",
    icon: KeyRound,
    permission: null,
    entitlement: null,
    searchTerms: ["password", "security", "login"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "switch_restaurant",
    title: "Switch restaurant",
    description: "Choose another restaurant you can manage",
    category: "personal",
    route: "/settings?setting=switch_restaurant",
    icon: Building2,
    permission: null,
    entitlement: null,
    searchTerms: ["restaurant", "outlet", "location", "switch"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "inline",
  },
  {
    id: "leave_restaurant",
    title: "Leave restaurant",
    description: "End your access to the current restaurant",
    category: "personal",
    route: "/leave-restaurant",
    icon: LogOut,
    permission: null,
    entitlement: null,
    searchTerms: ["leave", "membership", "remove access"],
    mobileBackTarget: "/settings",
    availabilityState: "available",
    surface: "route",
  },
  // Compatibility-only deep links. They stay resolvable but are intentionally
  // absent from the primary directory until their underlying capability is real.
  {
    id: "language",
    title: "Language",
    description: "Additional languages are not available yet",
    category: "personal",
    route: "/settings?setting=language",
    icon: Monitor,
    permission: null,
    entitlement: null,
    searchTerms: ["language", "Nepali", "translation"],
    mobileBackTarget: "/settings",
    availabilityState: "hidden",
    surface: "inline",
  },
  {
    id: "gallery_management",
    title: "Gallery",
    description: "Gallery management is not available yet",
    category: "business",
    route: "/settings?setting=gallery_management",
    icon: ImageIcon,
    permission: "settings.manage_restaurant",
    entitlement: null,
    searchTerms: ["gallery", "image", "photo"],
    mobileBackTarget: "/settings",
    availabilityState: "hidden",
    surface: "inline",
  },
  {
    id: "auto_backup",
    title: "Auto backup",
    description: "Automated backups are not available yet",
    category: "administration",
    route: "/settings?setting=auto_backup",
    icon: Download,
    permission: "admin.settings.manage",
    entitlement: null,
    searchTerms: ["backup", "automatic", "data"],
    mobileBackTarget: "/settings",
    availabilityState: "hidden",
    surface: "inline",
  },
  {
    id: "delete_account",
    title: "Delete account",
    description: "Permanently delete your Yummy account",
    category: "personal",
    route: "/settings?setting=delete_account",
    icon: LogOut,
    permission: null,
    entitlement: null,
    searchTerms: ["delete", "account", "danger"],
    mobileBackTarget: "/settings",
    availabilityState: "hidden",
    surface: "inline",
  },
];

export const SETTINGS_ITEMS_BY_ID = Object.fromEntries(
  SETTINGS_NAVIGATION_ITEMS.map((item) => [item.id, item]),
) as Record<string, SettingsNavigationItem>;

const SETTINGS_QUERY_ALIASES: Record<string, string> = {
  branding: "business_profile",
  kitchen_sounds: "device_preferences",
  push_alerts: "device_preferences",
  email_summaries: "device_preferences",
};

export function resolveSettingsItemId(value: string | null | undefined) {
  if (!value) return null;
  return SETTINGS_QUERY_ALIASES[value] ?? value;
}

export function getSettingsRouteOwnership(pathname: string) {
  const candidates = SETTINGS_NAVIGATION_ITEMS.filter(
    (item) => item.surface === "route",
  ).sort((a, b) => b.route.length - a.route.length);

  return candidates.find((item) => {
    const routePath = item.route.split("?")[0];
    return pathname === routePath || pathname.startsWith(`${routePath}/`);
  });
}

export function isSettingsOwnedRoute(pathname: string) {
  const item = getSettingsRouteOwnership(pathname);
  return Boolean(item && item.mobileBackTarget === "/settings");
}
