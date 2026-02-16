"use client";

import { useState, useCallback, useEffect } from "react";
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
    Search,
    LayoutGrid,
    Receipt,
    ClipboardList,
    Check,
    X,
    Loader2,
    Settings2,
    ArrowRight,
    ChevronRight,
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
    Image as ImageIcon
} from "lucide-react";
import { MenuGalleryDialog } from "@/components/menu/menu-gallery-dialog";
import { MenuGalleryItem } from "@/lib/constants/menu-gallery";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/hooks/use-preferences";
import { useRestaurant } from "@/hooks/use-restaurant";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { AdminManagement } from "@/components/manage/settings/admin-management";
import { SwitchRestaurant } from "@/components/manage/settings/switch-restaurant";
import { ReceiptDesigner } from "@/components/manage/settings/receipt-designer";
import { KOTDesigner } from "@/components/manage/settings/kot-designer";
import { PrinterManagement } from "@/components/manage/settings/printer-management";
import { DataExporter } from "@/components/manage/settings/data-exporter";
import { useRouter } from "next/navigation";
import { AuthApis } from "@/lib/api/endpoints";
import { useRef } from "react";
import { supabase } from "@/lib/supabase";
import { MenuImageService } from "@/services/menu-image-service";
import { Upload } from "lucide-react";

// --- Categories Definition ---
const categories = [
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
    }
];

export default function AdditionalSettingsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Dynamic Gallery State
    const [customImages, setCustomImages] = useState<{ name: string, url: string }[]>([]);
    const [loadingGallery, setLoadingGallery] = useState(false);
    const [uploadingToGallery, setUploadingToGallery] = useState(false);
    const galleryFileInputRef = useRef<HTMLInputElement>(null);
    
    // Auth and Restaurant
    const { user, me } = useAuth();
    const { restaurant, fetchRestaurant } = useRestaurant();
    const { logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { preferences, updatePreference } = usePreferences();
    const router = useRouter();

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [selectingFor, setSelectingFor] = useState<'profile' | 'cover' | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
    const filteredCategories = categories.map((cat: any) => ({
        ...cat,
        items: cat.items.filter((item: any) => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter((cat: any) => cat.items.length > 0);

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
        if (!restaurant) return;
        try {
            setIsUpdating(true);
            const response = await apiClient.put(RestaurantApis.update(restaurant.id), {
                tax_enabled: enabled
            });
            if (response.data.status === 'success') {
                await fetchRestaurant(true);
                toast.success(`Tax calculation ${enabled ? 'enabled' : 'disabled'}`);
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
                confirm_password: passwords.confirm
            });
            toast.success("Password updated successfully");
            setSelectedSetting(null);
            setPasswords({ current: "", new: "", confirm: "" });
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update password");
        } finally {
            setPasswordLoading(false);
        }
    };

    const fetchGalleryImages = useCallback(async () => {
    if (!user?.restaurant_id || !supabase) return;
    setLoadingGallery(true);
    try {
      const { data, error } = await supabase.storage
        .from('menu-items')
        .list(`${user.restaurant_id}/`, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (error) throw error;

      if (data) {
        const imagesWithUrls = data
          .filter((file: any) => file.name !== '.emptyFolderPlaceholder')
          .map((file: any) => {
            const { data: { publicUrl } } = supabase.storage
              .from('menu-items')
              .getPublicUrl(`${user.restaurant_id}/${file.name}`);
            return { name: file.name, url: publicUrl };
          });
        setCustomImages(imagesWithUrls);
      }
    } catch (err) {
      console.error('Error fetching gallery images:', err);
      toast.error('Failed to load gallery images');
    } finally {
      setLoadingGallery(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (selectedSetting === 'gallery_management') {
      fetchGalleryImages();
    }
  }, [selectedSetting, fetchGalleryImages]);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.restaurant_id) return;

    setUploadingToGallery(true);
    try {
      await MenuImageService.uploadMenuImage(file, user.restaurant_id);
      toast.success('Image uploaded to gallery');
      fetchGalleryImages(); // Refresh list
    } catch (err) {
      console.error('Gallery upload failed:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploadingToGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const handleDeleteGalleryImage = async (fileName: string) => {
    if (!user?.restaurant_id || !supabase) return;
    
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const { error } = await supabase.storage
        .from('menu-items')
        .remove([`${user.restaurant_id}/${fileName}`]);

      if (error) throw error;
      
      toast.success('Image deleted');
      fetchGalleryImages();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete image');
    }
  };

  const handleGallerySelect = async (item: MenuGalleryItem) => {
        if (!restaurant || !selectingFor) return;
        
        try {
            setIsUpdating(true);
            const payload = selectingFor === 'profile' 
                ? { profile_picture: item.assetPath }
                : { cover_photo: item.assetPath };
                
            const response = await apiClient.put(RestaurantApis.update(restaurant.id), payload);
            if (response.data.status === 'success') {
                await fetchRestaurant(true);
                toast.success(`${selectingFor === 'profile' ? 'Profile picture' : 'Cover photo'} updated`);
                setGalleryOpen(false);
            }
        } catch (err) {
            toast.error("Failed to update branding image");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleLogout = () => {
        logout();
        toast.success("Logged out successfully");
    };

    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);
            const response = await apiClient.delete(AuthApis.deleteMe);
            if (response.data.status === 'success') {
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
                                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">Theme Mode</Label>
                                <p className="text-sm font-bold tracking-tight">Switch between light and dark themes</p>
                            </div>
                            <div className="flex bg-muted p-1 rounded-lg border border-border/40">
                                {['light', 'dark', 'system'].map((t: any) => (
                                    <Button 
                                        key={t}
                                        variant={theme === t ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setTheme(t)}
                                        className={cn(
                                            "h-8 text-[11px] font-bold uppercase tracking-wider capitalize",
                                            theme === t && "shadow-sm bg-background"
                                        )}
                                    >
                                        {t}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "printer_management":
                return restaurant ? <PrinterManagement restaurantId={restaurant.id} /> : null;
            case "language":
                return (
                    <div className="space-y-6 py-4 text-center">
                        <Languages className="w-12 h-12 mx-auto text-indigo-500 opacity-20" />
                        <div className="space-y-1">
                            <p className="font-bold">Multilingual Support</p>
                            <p className="text-sm text-muted-foreground">
                                We currently support English. Nepali, Hindi, and Arabic support is coming soon.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <Button variant="outline" className="justify-between border-primary/50 text-primary">
                                English <Check className="w-4 h-4 ml-2" />
                            </Button>
                            <Button variant="ghost" className="justify-between opacity-50 cursor-not-allowed">
                                Nepali
                            </Button>
                        </div>
                    </div>
                );
            case "push_alerts":
            case "email_summaries":
            case "kot_notifications":
            case "order_notifications":
            case "kitchen_sounds":
            case "auto_backup":
                const prefKey = selectedSetting === 'kot_notifications' ? 'is_kot_notification_enabled' 
                             : selectedSetting === 'order_notifications' ? 'is_order_notification_enabled'
                             : selectedSetting;
                
                const currentItem = categories.flatMap((c: any) => c.items).find((i: any) => i.id === selectedSetting);
                const title = currentItem?.title;
                const desc = currentItem?.description;

                return (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">{title}</Label>
                                <p className="text-sm font-bold tracking-tight">{desc}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {selectedSetting === 'kitchen_sounds' && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                                            audio.play().catch(e => toast.error("Browser blocked audio. Click to enable."));
                                        }}
                                        className="h-8 text-[10px] uppercase font-bold tracking-wider"
                                    >
                                        Test Sound
                                    </Button>
                                )}
                                <Switch 
                                    checked={preferences[prefKey as keyof typeof preferences] as boolean}
                                    onCheckedChange={(val: any) => handleTogglePreference(prefKey, val)}
                                    disabled={isUpdating}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "change_password":
                return (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Current Password</Label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="font-bold border-border/40" 
                                value={passwords.current}
                                onChange={(e: any) => setPasswords({...passwords, current: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest opacity-60">New Password</Label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="font-bold border-border/40" 
                                value={passwords.new}
                                onChange={(e: any) => setPasswords({...passwords, new: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Confirm New Password</Label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="font-bold border-border/40" 
                                value={passwords.confirm}
                                onChange={(e: any) => setPasswords({...passwords, confirm: e.target.value})}
                            />
                        </div>
                        <Button 
                            className="w-full mt-2 font-black uppercase tracking-tighter italic h-12"
                            onClick={handleUpdatePassword}
                            disabled={passwordLoading}
                        >
                            {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Update Security Credentials"}
                        </Button>
                    </div>
                );
            case "tax_toggle":
                return (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60 text-emerald-600">Tax Enablement</Label>
                                <p className="text-sm font-bold tracking-tight">Toggle tax calculations globally.</p>
                            </div>
                            <Switch 
                                checked={restaurant?.tax_enabled}
                                onCheckedChange={handleToggleTax}
                                disabled={isUpdating}
                            />
                        </div>
                    </div>
                );
            case "admin_management":
                return restaurant ? <AdminManagement restaurantId={restaurant.id} /> : null;
            case "switch_restaurant":
                return <SwitchRestaurant />;
            case "data_export":
                return restaurant ? <DataExporter restaurantId={restaurant.id} /> : null;
            case "contact_support":
                return (
                    <div className="space-y-6 py-6 text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
                            <HelpCircle className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-black text-lg uppercase italic tracking-tight">Need Assistance?</h4>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">Our technical team is available 24/7.</p>
                        </div>
                        <div className="grid gap-3 pt-4">
                            <Button className="w-full h-12 font-black uppercase tracking-widest" onClick={() => window.location.href = 'mailto:support@yummy.com'}>
                                <Mail className="w-4 h-4 mr-2" /> Email Support
                            </Button>
                            <Button variant="outline" className="w-full h-12 font-black uppercase tracking-widest border-border/40">
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
                            <h4 className="font-black text-lg uppercase italic tracking-tight">Resource Center</h4>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">Master the Yummy Dashboard with our tutorials.</p>
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
                            <h4 className="font-black text-lg uppercase italic tracking-tight">{selectedSetting === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</h4>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">Read our legal documentation and usage agreements.</p>
                        </div>
                        <Button variant="outline" className="w-full h-12 font-black uppercase tracking-widest border-border/40">
                            View Full Document
                        </Button>
                    </div>
                );

            case "gallery_management":
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-medium tracking-tight">Menu Gallery</h3>
                                <p className="text-sm text-muted-foreground font-medium">Photos you've uploaded for your menu and branding.</p>
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
                                    {uploadingToGallery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Upload Photo
                                </Button>
                            </div>
                        </div>

                        {loadingGallery ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse border border-border/20" />
                                ))}
                            </div>
                        ) : customImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-muted/20 border-border/30">
                                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">Your gallery is empty</p>
                                <p className="text-xs text-muted-foreground/60 font-bold mt-1">Upload photos to use them across your dashboard.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {customImages.map((img: any) => (
                                    <div key={img.name} className="group relative aspect-square rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-xl transition-all duration-300">
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

            case "branding":
                return (
                    <div className="space-y-8 py-2">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold tracking-tight uppercase italic underline decoration-primary/30 decoration-4 underline-offset-4">Restaurant Branding</h3>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">Customize how your restaurant appears across the platform.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">Restaurant Logo</Label>
                                <div className="relative group w-32 h-32 rounded-3xl overflow-hidden border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center">
                                    {restaurant?.profile_picture ? (
                                        <img 
                                            src={restaurant.profile_picture.startsWith('http') ? restaurant.profile_picture : `/${restaurant.profile_picture.replace('asset:', 'assets/')}`} 
                                            alt="Logo" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-9 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                            onClick={() => { setSelectingFor('profile'); setGalleryOpen(true); }}
                                        >
                                            Change Logo
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight italic opacity-60">1:1 square ratio, min 400x400px</p>
                                    <p className="text-[11px] text-foreground font-bold">Appears in customer search and invoices.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black tracking-widest uppercase opacity-60">Cover Photo</Label>
                                <div className="relative group h-32 rounded-3xl overflow-hidden border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center">
                                    {restaurant?.cover_photo ? (
                                        <img 
                                            src={restaurant.cover_photo.startsWith('http') ? restaurant.cover_photo : `/${restaurant.cover_photo.replace('asset:', 'assets/')}`} 
                                            alt="Cover" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-9 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                            onClick={() => { setSelectingFor('cover'); setGalleryOpen(true); }}
                                        >
                                            Update Cover
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight italic opacity-60">16:9 landscape ratio, min 1200x675px</p>
                                    <p className="text-[11px] text-foreground font-bold">Appears as your restaurant header background.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case "logout":
                return (
                    <div className="py-6 text-center space-y-6">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
                            <LogOut className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-black text-xl uppercase italic tracking-tight">Sign Out?</h4>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">Are you sure you want to end your current session?</p>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1 h-12 font-bold border-border/40" onClick={() => setSelectedSetting(null)}>
                                Stay Logged In
                            </Button>
                            <Button className="flex-1 h-12 font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700" onClick={handleLogout}>
                                Logout Now
                            </Button>
                        </div>
                    </div>
                );
            case "delete_account":
                return (
                    <div className="py-6 text-center space-y-6">
                        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto text-rose-600">
                            <Trash2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-black text-xl uppercase italic tracking-tight text-rose-600">Delete Account</h4>
                            <p className="text-sm text-muted-foreground font-bold opacity-60">
                                This action is permanent and cannot be undone. All your data will be erased.
                            </p>
                        </div>
                        <Button className="w-full h-12 font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700" onClick={() => setIsDeleteConfirmOpen(true)}>
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
                                We're porting the {selectedSetting?.replace("_", " ")} logic from our mobile platform to provide the best experience.
                            </p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-12 pb-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
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
            </div>

            <div className="grid grid-cols-1 gap-12">
                {filteredCategories.map((section: any) => (
                    <div key={section.title} className="space-y-5">
                        <h2 className="text-[11px] font-black tracking-[0.2em] text-muted-foreground/70 uppercase">
                            {section.title}
                        </h2>
                       
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {section.items.map((item: any) => (
                                <button 
                                    key={item.id}
                                    className="group text-left focus:outline-none"
                                    onClick={() => {
                                        if (['receipt_designer', 'kot_designer'].includes(item.id)) {
                                            router.push(`/manage/${item.id.replace('_', '-')}`);
                                            return;
                                        }
                                        if (item.id === 'audit_logs') {
                                            router.push('/manage/audit-logs');
                                            return;
                                        }
                                        if (item.id === 'tax_configuration') {
                                            router.push('/manage/taxes');
                                            return;
                                        }
                                        setSelectedSetting(item.id);
                                    }}
                                >
                                    <Card className="group hover:border-primary/50 transition-all hover:shadow-md cursor-pointer border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden h-[90px]">
                                        <CardContent className="h-full p-4 flex items-center gap-4">
                                            <div className={cn(
                                                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm border border-white/10",
                                                item.iconBg,
                                                item.iconColor
                                            )}>
                                                <item.icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-[14px] font-bold group-hover:text-primary transition-colors truncate mb-0.5 uppercase tracking-tight">
                                                    {item.title}
                                                </h3>
                                                <p className="text-[11px] text-muted-foreground font-medium line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity leading-tight">
                                                    {item.description}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0" />
                                        </CardContent>
                                    </Card>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={!!selectedSetting} onOpenChange={(open: boolean) => !open && setSelectedSetting(null)}>
                <DialogContent className={cn(
                    "border-border/40 backdrop-blur-2xl transition-all duration-500",
                    (selectedSetting === 'receipt_designer' || selectedSetting === 'kot_designer' || selectedSetting === 'printer_management') ? "sm:max-w-[1000px]" : "sm:max-w-[500px]"
                )}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight uppercase italic">
                            {selectedSetting && categories.flatMap((c: any) => c.items).find((i: any) => i.id === selectedSetting)?.title}
                        </DialogTitle>
                        <DialogDescription className="font-bold text-muted-foreground/80">
                            Configure your {selectedSetting?.replace("_", " ")} preferences and system parameters.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto pr-4 -mr-4 max-h-[70vh] custom-scrollbar">
                        {renderSettingContent()}
                    </div>

                    <DialogFooter className="sm:justify-end gap-2 pt-4 border-t border-border/20">
                         <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setSelectedSetting(null)}
                            className="font-bold uppercase tracking-widest text-[10px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setSelectedSetting(null)}
                            className="font-black uppercase tracking-widest text-[10px] px-8"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {filteredCategories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="bg-muted p-4 rounded-full">
                        <LayoutGrid className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-lg font-black tracking-tight italic uppercase">No settings match your request</p>
                        <p className="text-muted-foreground font-bold opacity-60">Try searching for alternative keywords.</p>
                    </div>
                </div>
            )}

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600 font-black uppercase italic tracking-tight">Final Confirmation</DialogTitle>
                        <DialogDescription className="font-bold">
                            Please type <span className="text-foreground">permanently delete</span> to confirm.
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
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 font-bold">
                            Keep Account
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 font-black uppercase italic"
                            disabled={isDeleting}
                            onClick={() => {
                                const val = (document.getElementById('delete-confirm-input') as HTMLInputElement)?.value;
                                if (val === 'permanently delete') {
                                    handleDeleteAccount();
                                } else {
                                    toast.error("Please type the confirmation phrase correctly");
                                }
                            }}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Delete Forever"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MenuGalleryDialog 
                open={galleryOpen} 
                onOpenChange={setGalleryOpen} 
                onSelect={handleGallerySelect} 
            />
        </div>
    );
}
