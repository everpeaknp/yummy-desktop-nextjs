"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Monitor,
  Printer,
  FileEdit,
  Bell,
  Mail,
  Volume2,
  Database,
  Languages,
  Download,
  ShieldCheck,
  Building2,
  Lock,
  HelpCircle,
  BookOpen,
  ShieldAlert,
  Scale,
  Percent,
  History,
  LayoutGrid,
  Receipt,
  ClipboardList,
  Check,
  X,
  Loader2,
  Settings2,
  ArrowRight,
  Clock,
  MapPin,
  Network,
  Package,
  Settings,
  UserCheck,
  Users,
  KeyRound,
  LogOut,
  Trash2,
  Camera,
  ImagePlus,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { Input } from "@/components/ui/input";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { EmptyState } from "@/components/patterns/feedback/feedback-state";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/hooks/use-preferences";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFiscalProfile } from "@/hooks/use-fiscal-profile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { SwitchRestaurant } from "@/components/manage/settings/switch-restaurant";
import { DataExporter } from "@/components/manage/settings/data-exporter";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthApis } from "@/lib/api/endpoints";
import { useRef } from "react";
import { ImageService } from "@/services/image-service";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/lib/role-permissions";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { isSubscriptionEntitlementEnabled } from "@/lib/subscription/entitlements";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_ITEMS_BY_ID,
  SETTINGS_NAVIGATION_ITEMS,
  resolveSettingsItemId,
  type SettingsCategoryId,
  type SettingsNavigationItem,
} from "@/lib/settings-navigation";

// --- Categories Definition ---
const legacyCategories = [
  {
    title: "DASHBOARD & APPEARANCE",
    items: [
      {
        id: "appearance",
        title: "Appearance",
        description: "Theme & visual preferences",
        icon: Monitor,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
      },
      {
        id: "language",
        title: "Language",
        description: "Change dashboard language",
        icon: Languages,
        iconColor: "text-indigo-500",
        iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
      },
    ],
  },
  {
    title: "RESTAURANT & BRANDING",
    items: [
      {
        id: "branding",
        title: "Branding",
        description: "Update restaurant logo & cover photo",
        icon: ImageIcon,
        iconColor: "text-rose-600",
        iconBg: "bg-rose-50 dark:bg-rose-900/20",
      },
      {
        id: "gallery_management",
        title: "Gallery",
        description: "Manage in-app photos",
        icon: ImagePlus,
        iconColor: "text-rose-500",
        iconBg: "bg-rose-50 dark:bg-rose-900/20",
      },
    ],
  },
  {
    title: "HARDWARE & PRINTING",
    items: [
      {
        id: "printer_management",
        title: "Printer Management",
        description: "Configure network & USB printers",
        icon: Printer,
        iconColor: "text-slate-600",
        iconBg: "bg-slate-100 dark:bg-slate-800/50",
      },
      {
        id: "receipt_designer",
        title: "Receipt Designer",
        description: "Customize bill layouts",
        icon: Receipt,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-50 dark:bg-amber-900/20",
      },
      {
        id: "kot_designer",
        title: "KOT Designer",
        description: "Customize KOT layouts",
        icon: FileEdit,
        iconColor: "text-orange-500",
        iconBg: "bg-orange-50 dark:bg-orange-900/20",
      },
      {
        id: "kitchen_sounds",
        title: "Kitchen Sounds",
        description: "Alert sounds for new orders",
        icon: Volume2,
        iconColor: "text-rose-500",
        iconBg: "bg-rose-50 dark:bg-rose-900/20",
      },
    ],
  },
  {
    title: "NOTIFICATIONS & ALERTS",
    items: [
      {
        id: "push_alerts",
        title: "Push Alerts",
        description: "Real-time browser notifications",
        icon: Bell,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
      },
      {
        id: "email_summaries",
        title: "Email Summaries",
        description: "Daily performance snapshots",
        icon: Mail,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      {
        id: "kot_notifications",
        title: "KOT Notifications",
        description: "Status update alerts",
        icon: ClipboardList,
        iconColor: "text-orange-500",
        iconBg: "bg-orange-50 dark:bg-orange-900/20",
      },
      {
        id: "order_notifications",
        title: "Order Notifications",
        description: "New order alerts",
        icon: Bell,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
      },
    ],
  },
  {
    title: "FINANCE & COMPLIANCE",
    items: [
      {
        id: "tax_configuration",
        title: "Tax Configuration",
        description: "Manage VAT, Service Charge, etc.",
        icon: Percent,
        iconColor: "text-cyan-600",
        iconBg: "bg-cyan-50 dark:bg-cyan-900/20",
      },
      {
        id: "tax_toggle",
        title: "Enable Tax",
        description: "Toggle global tax calculation",
        icon: ShieldCheck,
        iconColor: "text-emerald-500",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      {
        id: "audit_logs",
        title: "Audit Logs",
        description: "Track system changes",
        icon: History,
        iconColor: "text-slate-500",
        iconBg: "bg-slate-50 dark:bg-slate-900/20",
      },
      {
        id: "data_export",
        title: "Data Export",
        description: "Download reports & datasets",
        icon: Download,
        iconColor: "text-emerald-500",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      {
        id: "auto_backup",
        title: "Auto Backup",
        description: "Configure data safety",
        icon: Database,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
      },
    ],
  },
  {
    title: "ACCOUNT & SECURITY",
    items: [
      {
        id: "admin_management",
        title: "Admin Management",
        description: "Manage dashboard users",
        icon: UserCheck,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
      },
      {
        id: "switch_restaurant",
        title: "Switch Restaurant",
        description: "Manage multiple outlets",
        icon: Building2,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-50 dark:bg-purple-900/20",
      },
      {
        id: "change_password",
        title: "Change Password",
        description: "Update login credentials",
        icon: KeyRound,
        iconColor: "text-slate-600",
        iconBg: "bg-slate-100 dark:bg-slate-800/50",
      },
      {
        id: "logout",
        title: "Log Out",
        description: "Sign out of your account",
        icon: LogOut,
        iconColor: "text-rose-500",
        iconBg: "bg-rose-50 dark:bg-rose-800/20",
      },
      {
        id: "delete_account",
        title: "Delete Account",
        description: "Permanently remove your account",
        icon: Trash2,
        iconColor: "text-rose-600",
        iconBg: "bg-rose-100 dark:bg-rose-900/20",
      },
    ],
  },
  {
    title: "SUPPORT & LEGAL",
    items: [
      {
        id: "contact_support",
        title: "Contact & Support",
        description: "Get help from our team",
        icon: HelpCircle,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
      },
      {
        id: "guides",
        title: "Guides & Tutorials",
        description: "Learn how to use Yummy",
        icon: BookOpen,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        description: "Data protection terms",
        icon: ShieldAlert,
        iconColor: "text-slate-600",
        iconBg: "bg-slate-50 dark:bg-slate-900/20",
      },
      {
        id: "terms",
        title: "Terms & Conditions",
        description: "Usage agreement",
        icon: Scale,
        iconColor: "text-slate-600",
        iconBg: "bg-slate-50 dark:bg-slate-900/20",
      },
    ],
  },
];

const legacySettingItems = Object.fromEntries(
  legacyCategories.flatMap((category) =>
    category.items.map((item) => [item.id, item]),
  ),
) as Record<string, any>;

export function SettingsHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearchParams();
  const initialSetting = resolveSettingsItemId(
    searchParams ? searchParams.get("setting") : null,
  );
  const [selectedSetting, setSelectedSetting] = useState<string | null>(
    initialSetting,
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Dynamic Gallery State
  const [customImages, setCustomImages] = useState<
    { name: string; url: string }[]
  >([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [uploadingToGallery, setUploadingToGallery] = useState(false);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // Auth and Restaurant
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const logout = useAuth((s) => s.logout);
  const restaurant = useRestaurant((s) => s.restaurant);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const {
    profile: fiscalProfile,
    isActiveVat,
    loading: fiscalProfileLoading,
  } = useFiscalProfile(Boolean(user?.restaurant_id));
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const router = useRouter();
  const currentSubscription = useSubscriptionStore((state) => state.current);
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategoryId>("business");
  const [isDesktop, setIsDesktop] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const accessibleItems = useMemo(
    () =>
      SETTINGS_NAVIGATION_ITEMS.filter((item) => {
        if (item.availabilityState !== "available") return false;
        return !item.permission || hasPermission(user, item.permission);
      }),
    [user],
  );

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return SETTINGS_CATEGORIES.map((category) => ({
      ...category,
      items: accessibleItems.filter((item) => {
        if (item.category !== category.id) return false;
        if (!query) return true;
        return [item.title, item.description, ...item.searchTerms].some(
          (value) => value.toLowerCase().includes(query),
        );
      }),
    })).filter((category) => category.items.length > 0);
  }, [accessibleItems, searchQuery]);

  const availableCategories = useMemo(
    () =>
      SETTINGS_CATEGORIES.filter((category) =>
        accessibleItems.some((item) => item.category === category.id),
      ),
    [accessibleItems],
  );

  const selectedItem = selectedSetting
    ? SETTINGS_ITEMS_BY_ID[selectedSetting]
    : null;

  const isItemRestricted = useCallback(
    (item: SettingsNavigationItem) =>
      Boolean(
        item.entitlement &&
        !isSubscriptionEntitlementEnabled(
          currentSubscription,
          item.entitlement,
          item.entitlementLegacyFallback ?? false,
        ),
      ),
    [currentSubscription],
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (availableCategories.some((category) => category.id === activeCategory))
      return;
    if (availableCategories[0]) setActiveCategory(availableCategories[0].id);
  }, [activeCategory, availableCategories]);

  const handleTogglePreference = async (key: any, value: boolean) => {
    try {
      setIsUpdating(true);
      await updatePreference(key, value);
      toast.success("Setting updated successfully");
    } catch (err) {
      toast.error("Failed to update setting");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleTax = async (enabled: boolean) => {
    if (!restaurant || isActiveVat || fiscalProfileLoading) return;
    try {
      setIsUpdating(true);
      const response = await apiClient.put(
        RestaurantApis.update(restaurant.id),
        {
          tax_enabled: enabled,
        },
      );
      if (response.data.status === "success") {
        await fetchRestaurant(true);
        toast.success(`Tax calculation ${enabled ? "enabled" : "disabled"}`);
      }
    } catch (err) {
      toast.error("Failed to update tax setting");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setPasswordLoading(true);
      await apiClient.post(AuthApis.changePassword, {
        old_password: passwords.current,
        new_password: passwords.new,
        confirm_password: passwords.confirm,
      });
      toast.success("Password updated successfully");
      closeInlineSetting();
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const fetchGalleryImages = useCallback(async () => {
    // Gallery fetching is currently disabled pending backend Cloudinary Gallery implementation
    setCustomImages([]);
    setLoadingGallery(false);
  }, []);

  useEffect(() => {
    if (selectedSetting === "gallery_management") {
      fetchGalleryImages();
    }
  }, [selectedSetting, fetchGalleryImages]);

  // Sync state when URL parameter changes
  useEffect(() => {
    const settingParam = resolveSettingsItemId(
      searchParams ? searchParams.get("setting") : null,
    );
    if (!settingParam) {
      setSelectedSetting(null);
      return;
    }

    const item = SETTINGS_ITEMS_BY_ID[settingParam];
    if (item?.surface === "route") {
      router.replace(item.route);
      return;
    }

    setSelectedSetting(settingParam);
    if (item) setActiveCategory(item.category);
  }, [searchParams, router]);

  const openInlineSetting = (item: SettingsNavigationItem) => {
    setSelectedSetting(item.id);
    setActiveCategory(item.category);
    router.replace(item.route, { scroll: false });
  };

  const closeInlineSetting = () => {
    setSelectedSetting(null);
    router.replace("/settings", { scroll: false });
  };

  const handleGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user?.restaurant_id) return;

    setUploadingToGallery(true);
    try {
      await ImageService.uploadMenuImage(file, user.restaurant_id);
      toast.success("Image uploaded successfully (Gallery view coming soon)");
      fetchGalleryImages(); // Refresh list
    } catch (err) {
      console.error("Gallery upload failed:", err);
      toast.error("Failed to upload image");
    } finally {
      setUploadingToGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryImage = async (fileName: string) => {
    toast.error(
      "Image deletion is currently disabled while we upgrade the gallery system.",
    );
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const response = await apiClient.delete(AuthApis.deleteMe);
      if (response.data.status === "success") {
        toast.success("Account deleted successfully");
        logout();
      }
    } catch (err) {
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const renderSettingContent = () => {
    if (!selectedSetting) return null;

    switch (selectedSetting) {
      case "appearance":
        return (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">
                  Theme Mode
                </Label>
                <p className="text-sm font-bold tracking-tight">
                  Switch between light and dark themes
                </p>
              </div>
              <div className="flex bg-muted p-1 rounded-lg border border-border/40">
                {["light", "dark", "system"].map((t: any) => (
                  <Button
                    key={t}
                    variant={theme === t ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTheme(t)}
                    className={cn(
                      "h-8 text-[11px] font-bold uppercase tracking-wider capitalize",
                      theme === t && "shadow-sm bg-background",
                    )}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );
      case "language":
        return (
          <div className="space-y-6 py-4 text-center">
            <Languages className="w-12 h-12 mx-auto text-indigo-500 opacity-20" />
            <div className="space-y-1">
              <p className="font-bold">Multilingual Support</p>
              <p className="text-sm text-muted-foreground">
                We currently support English. Nepali, Hindi, and Arabic support
                is coming soon.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                className="justify-between border-primary/50 text-primary"
              >
                English <Check className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="justify-between opacity-50 cursor-not-allowed"
              >
                Nepali
              </Button>
            </div>
          </div>
        );
      case "kot_notifications":
      case "order_notifications":
      case "auto_backup":
        const prefKey =
          selectedSetting === "kot_notifications"
            ? "is_kot_notification_enabled"
            : selectedSetting === "order_notifications"
              ? "is_order_notification_enabled"
              : selectedSetting;

        const currentItem = selectedSetting
          ? SETTINGS_ITEMS_BY_ID[selectedSetting]
          : null;
        const title = currentItem?.title;
        const desc = currentItem?.description;

        return (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">
                  {title}
                </Label>
                <p className="text-sm font-bold tracking-tight">{desc}</p>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={
                    preferences[prefKey as keyof typeof preferences] as boolean
                  }
                  onCheckedChange={(val: any) =>
                    handleTogglePreference(prefKey, val)
                  }
                  disabled={isUpdating}
                />
              </div>
            </div>
          </div>
        );
      case "device_preferences":
        return (
          <div className="divide-y divide-border py-1">
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">Kitchen sounds</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Play a sound for kitchen alerts on this device.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const audio = new Audio(
                      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
                    );
                    audio
                      .play()
                      .catch(() =>
                        toast.error(
                          "Browser blocked audio. Enable sound and try again.",
                        ),
                      );
                  }}
                >
                  Test
                </Button>
                <Switch
                  checked={preferences.kitchen_sound ?? true}
                  onCheckedChange={(value) =>
                    handleTogglePreference("kitchen_sound", value)
                  }
                  disabled={isUpdating}
                  aria-label="Kitchen sounds on this device"
                />
              </div>
            </div>
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">Browser alerts</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Remember alert visibility in this browser.
                </p>
              </div>
              <Switch
                checked={preferences.push_alerts ?? true}
                onCheckedChange={(value) =>
                  handleTogglePreference("push_alerts", value)
                }
                disabled={isUpdating}
                aria-label="Browser alerts on this device"
              />
            </div>
          </div>
        );
      case "change_password":
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">
                Current Password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                className="font-bold border-border/40"
                value={passwords.current}
                onChange={(e: any) =>
                  setPasswords({ ...passwords, current: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">
                New Password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                className="font-bold border-border/40"
                value={passwords.new}
                onChange={(e: any) =>
                  setPasswords({ ...passwords, new: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">
                Confirm New Password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                className="font-bold border-border/40"
                value={passwords.confirm}
                onChange={(e: any) =>
                  setPasswords({ ...passwords, confirm: e.target.value })
                }
              />
            </div>
            <Button
              className="w-full mt-2 font-black uppercase tracking-tighter italic h-12"
              onClick={handleUpdatePassword}
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                "Update Security Credentials"
              )}
            </Button>
          </div>
        );
      case "tax_toggle":
        return (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60 text-emerald-600">
                  Tax Enablement
                </Label>
                <p className="text-sm font-bold tracking-tight">
                  {isActiveVat
                    ? `Locked by the active ${fiscalProfile?.fiscal_billing_mode ?? "VAT"} fiscal profile.`
                    : "Toggle tax calculations globally."}
                </p>
                {isActiveVat && (
                  <p className="text-xs text-muted-foreground">
                    VAT settings are managed by Yummy&apos;s compliance team.
                  </p>
                )}
              </div>
              <Switch
                checked={isActiveVat ? true : restaurant?.tax_enabled}
                onCheckedChange={handleToggleTax}
                disabled={isUpdating || isActiveVat || fiscalProfileLoading}
              />
            </div>
          </div>
        );
      case "switch_restaurant":
        return <SwitchRestaurant />;
      case "data_export":
        return restaurant ? (
          <DataExporter restaurantId={restaurant.id} />
        ) : null;
      case "contact_support":
        return (
          <div className="space-y-6 py-6 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
              <HelpCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-lg uppercase italic tracking-tight">
                Need Assistance?
              </h4>
              <p className="text-sm text-muted-foreground font-bold opacity-60">
                Our technical team is available 24/7.
              </p>
            </div>
            <div className="grid gap-3 pt-4">
              <Button
                className="w-full h-12 font-black uppercase tracking-widest"
                onClick={() =>
                  (window.location.href = "mailto:support@yummy.com")
                }
              >
                <Mail className="w-4 h-4 mr-2" /> Email Support
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 font-black uppercase tracking-widest border-border/40"
              >
                <Monitor className="w-4 h-4 mr-2" /> Live Chat
              </Button>
            </div>
          </div>
        );
      case "guides":
        return (
          <div className="space-y-6 py-6 text-center">
            <BookOpen className="w-16 h-16 text-emerald-500 opacity-20 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-black text-lg uppercase italic tracking-tight">
                Resource Center
              </h4>
              <p className="text-sm text-muted-foreground font-bold opacity-60">
                Master the Yummy Dashboard with our tutorials.
              </p>
            </div>
            <Button className="w-full h-12 font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700">
              Visit Documentation <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );
      case "privacy":
      case "terms":
        return (
          <div className="space-y-6 py-6 text-center">
            <Scale className="w-16 h-16 text-muted-foreground opacity-20 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-black text-lg uppercase italic tracking-tight">
                {selectedSetting === "privacy"
                  ? "Privacy Policy"
                  : "Terms of Service"}
              </h4>
              <p className="text-sm text-muted-foreground font-bold opacity-60">
                Read our legal documentation and usage agreements.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 font-black uppercase tracking-widest border-border/40"
            >
              View Full Document
            </Button>
          </div>
        );

      case "gallery_management":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium tracking-tight">
                  Menu Gallery
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Photos you&apos;ve uploaded for your menu and branding.
                </p>
              </div>
              <div>
                <input
                  type="file"
                  ref={galleryFileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleGalleryUpload}
                />
                <Button
                  onClick={() => galleryFileInputRef.current?.click()}
                  disabled={uploadingToGallery}
                  className="bg-primary hover:bg-primary/90 rounded-xl"
                >
                  {uploadingToGallery ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload Photo
                </Button>
              </div>
            </div>

            {loadingGallery ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-muted rounded-xl animate-pulse border border-border/20"
                  />
                ))}
              </div>
            ) : customImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-muted/20 border-border/30">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Your gallery is empty
                </p>
                <p className="text-xs text-muted-foreground/60 font-bold mt-1">
                  Upload photos to use them across your dashboard.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {customImages.map((img: any) => (
                  <div
                    key={img.name}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-xl transition-all duration-300"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 backdrop-blur-[2px]">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-10 w-10 rounded-full shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300"
                        onClick={() => handleDeleteGalleryImage(img.name)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "delete_account":
        return (
          <div className="py-6 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h4 className="font-black text-xl uppercase italic tracking-tight text-rose-600">
                Delete Account
              </h4>
              <p className="text-sm text-muted-foreground font-bold opacity-60">
                This action is permanent and cannot be undone. All your data
                will be erased.
              </p>
            </div>
            <Button
              className="w-full h-12 font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              I Understand, Delete My Account
            </Button>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
              <Settings2 className="w-8 h-8 text-amber-600 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-lg">Coming Very Soon</p>
              <p className="text-sm text-muted-foreground max-w-[280px] mx-auto font-medium">
                We&apos;re porting the {selectedSetting?.replace("_", " ")}{" "}
                logic from our mobile platform to provide the best experience.
              </p>
            </div>
          </div>
        );
    }
  };

  const activeCategoryDetails =
    availableCategories.find((category) => category.id === activeCategory) ??
    availableCategories[0];
  const desktopCategories = searchQuery.trim()
    ? filteredCategories
    : activeCategoryDetails
      ? [
          {
            ...activeCategoryDetails,
            items: accessibleItems.filter(
              (item) => item.category === activeCategoryDetails.id,
            ),
          },
        ]
      : [];
  const selectedItemAccessible =
    !selectedItem?.permission || hasPermission(user, selectedItem.permission);

  const renderNavigationRow = (
    item: SettingsNavigationItem,
    options: { desktop?: boolean } = {},
  ) => {
    const Icon = item.icon;
    const restricted = isItemRestricted(item);
    const row = (
      <ListRow
        leading={<Icon className="h-4 w-4" />}
        title={item.title}
        description={item.description}
        value={
          restricted ? (
            <Badge variant="outline" className="whitespace-nowrap">
              Plan required
            </Badge>
          ) : undefined
        }
        interactive={!restricted}
        className={cn(
          "[min-height:3.25rem] py-2",
          options.desktop &&
            selectedSetting === item.id &&
            "bg-primary/5 [&>div:first-child]:bg-primary/10 [&>div:first-child]:text-primary",
          restricted && "cursor-not-allowed opacity-65",
        )}
      />
    );

    if (restricted) {
      return (
        <div key={item.id} aria-disabled="true">
          {row}
        </div>
      );
    }

    if (item.surface === "route") {
      return (
        <Link
          key={item.id}
          href={item.route}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {row}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => openInlineSetting(item)}
      >
        {row}
      </button>
    );
  };

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <PageHeader
        className="hidden lg:flex"
        title="Settings"
        description="Configuration for your business, team, devices, and account."
      />
      <SearchField
        placeholder="Search settings"
        value={searchQuery}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setSearchQuery(e.target.value)
        }
        className="lg:hidden"
      />
      {/* Legacy internal header intentionally removed; the shared app bar owns internal-route navigation. */}
      {/*
                <div className="space-y-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/manage")}
                        className="w-fit gap-2 px-0 text-muted-foreground hover:text-foreground"
                    >
                        Back to Manage
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Additional Settings</h1>
                    <p className="text-muted-foreground font-medium">
                        Advanced configuration hub • System management • Legal & Support
                    </p>
                </div>
                
                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Search settings..." 
                        className="pl-9 bg-card/40 backdrop-blur-md border-border/40 h-11 ring-offset-background font-bold"
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                </div>
            */}

      <div className="space-y-5 lg:hidden">
        {filteredCategories.map((category) => (
          <section
            key={category.id}
            className={cn(
              "space-y-1",
              category.id === "personal" && "border-t border-border pt-5",
            )}
          >
            <h2 className="px-1 text-sm font-semibold text-foreground">
              {category.title}
            </h2>
            <DataList className="rounded-none border-x-0 bg-transparent shadow-none">
              {category.items.map((item) => renderNavigationRow(item))}
            </DataList>
          </section>
        ))}
      </div>

      <div className="hidden min-h-[calc(100vh-12rem)] grid-cols-[272px_minmax(0,1fr)] gap-8 lg:grid">
        <aside className="sticky top-24 h-fit space-y-4">
          <SearchField
            placeholder="Search settings"
            value={searchQuery}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(event.target.value)
            }
          />
          <nav aria-label="Settings categories" className="space-y-1">
            {availableCategories.map((category) => {
              const Icon = category.icon;
              const isActive =
                !searchQuery.trim() && category.id === activeCategory;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setSearchQuery("");
                    closeInlineSetting();
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{category.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 border-l border-border pl-8">
          {selectedItem ? (
            selectedItemAccessible ? (
              <div className="max-w-3xl space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {selectedItem.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.description}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeInlineSetting}
                  >
                    Back
                  </Button>
                </div>
                {renderSettingContent()}
              </div>
            ) : (
              <EmptyState
                title="Setting unavailable"
                description="Your current role does not allow access to this setting."
              />
            )
          ) : desktopCategories.length ? (
            <div className="max-w-3xl space-y-8">
              {desktopCategories.map((category) => (
                <section key={category.id} className="space-y-3">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {category.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <DataList className="rounded-xl">
                    {category.items.map((item) =>
                      renderNavigationRow(item, { desktop: true }),
                    )}
                  </DataList>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No settings found"
              description="Try a different setting name or keyword."
            />
          )}
        </main>
      </div>

      <Dialog
        open={!isDesktop && Boolean(selectedItem)}
        onOpenChange={(open: boolean) => !open && closeInlineSetting()}
      >
        <DialogContent className="max-h-[92dvh] overflow-hidden sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
            <DialogDescription>{selectedItem?.description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {selectedItemAccessible ? (
              renderSettingContent()
            ) : (
              <EmptyState
                title="Setting unavailable"
                description="Your current role does not allow access to this setting."
              />
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeInlineSetting}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredCategories.length === 0 && (
        <div className="lg:hidden">
          <EmptyState
            title="No settings found"
            description="Try a different setting name or keyword."
          />
        </div>
      )}

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-rose-600 font-black uppercase italic tracking-tight">
              Final Confirmation
            </DialogTitle>
            <DialogDescription className="font-bold">
              Please type{" "}
              <span className="text-foreground">permanently delete</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Type 'permanently delete'"
              className="font-bold border-rose-200 focus-visible:ring-rose-500"
              id="delete-confirm-input"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 font-bold"
            >
              Keep Account
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-black uppercase italic"
              disabled={isDeleting}
              onClick={() => {
                const val = (
                  document.getElementById(
                    "delete-confirm-input",
                  ) as HTMLInputElement
                )?.value;
                if (val === "permanently delete") {
                  handleDeleteAccount();
                } else {
                  toast.error("Please type the confirmation phrase correctly");
                }
              }}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                "Delete Forever"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
