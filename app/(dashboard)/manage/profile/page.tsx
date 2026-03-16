"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    ChevronLeft,
    Store,
    MapPin,
    Phone,
    FileText,
    Camera,
    Upload,
    Save,
    RefreshCw,
    Loader2,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/utils";
import LocationPicker from "@/components/manage/profile/location-picker";
import { useCallback, useRef } from "react";
import { ImageService } from "@/services/image-service";
import { useRestaurant } from "@/hooks/use-restaurant";

export default function RestaurantProfilePage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const fetchGlobalRestaurant = useRestaurant(state => state.fetchRestaurant);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        phone: "",
        pan_number: "",
        description: "",
        profile_picture: "",
        cover_photo: "",
        timezone: "UTC",
        latitude: "",
        longitude: "",
        local_pos_ip: "",
    });
    const [initialData, setInitialData] = useState<typeof formData | null>(null);

    const hasChanges = initialData ? JSON.stringify(formData) !== JSON.stringify(initialData) : false;

    useEffect(() => {
        const fetchRestaurant = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(RestaurantApis.getById(user.restaurant_id));
                if (res.data.status === "success") {
                    const r = res.data.data;
                    const data = {
                        name: r.name || "",
                        address: r.address || "",
                        phone: r.phone || "",
                        pan_number: r.pan_number || "",
                        description: r.description || "",
                        profile_picture: r.profile_picture || "",
                        cover_photo: r.cover_photo || "",
                        timezone: r.timezone || "UTC",
                        latitude: r.latitude || "",
                        longitude: r.longitude || "",
                        local_pos_ip: r.local_pos_ip || "",
                    };
                    setFormData(data);
                    setInitialData(data);
                }
            } catch (err) {
                console.error("Failed to fetch restaurant", err);
                toast.error("Failed to load restaurant profile");
            } finally {
                setLoading(false);
            }
        };
        fetchRestaurant();
    }, [user?.restaurant_id]);

    const handleLocationChange = useCallback((lat: string, lng: string) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }));
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
        const file = e.target.files?.[0];
        if (!file || !user?.restaurant_id) return;

        type === 'logo' ? setUploadingLogo(true) : setUploadingCover(true);
        try {
            const publicUrl = await ImageService.uploadRestaurantImage(file, type, user.restaurant_id);
            
            setFormData(prev => ({
                ...prev,
                [type === 'logo' ? 'profile_picture' : 'cover_photo']: publicUrl
            }));
            toast.success(`${type === 'logo' ? 'Logo' : 'Cover image'} uploaded`);
        } catch (err: any) {
            console.error(`Failed to upload ${type}`, err);
            if (err.response) {
                console.error("Error Response Data:", err.response.data);
            }
            toast.error(`Failed to upload ${type}`);
        } finally {
            type === 'logo' ? setUploadingLogo(false) : setUploadingCover(false);
            // Reset input so the same file can be selected again if needed
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanges) {
            toast.info("No changes to save");
            return;
        }

        console.log("Submitting Profile Data:", formData);

        if (!user?.restaurant_id) {
            toast.error("No restaurant ID found");
            return;
        }

        setSaving(true);
        try {
            const res = await apiClient.put(RestaurantApis.update(user.restaurant_id), formData);
            console.log("Update Response:", res.data);
            if (res.data.status === "success") {
                toast.success("Profile updated successfully");
                setInitialData({ ...formData }); // Sync local state
                fetchGlobalRestaurant(true); // Sync global branding state across app
            } else {
                toast.error(res.data.message || "Failed to update profile");
            }
        } catch (error: any) {
            console.error("Failed to update profile", error);
            const detail = error.response?.data?.detail;
            const message = typeof detail === 'string' ? detail : (detail?.[0]?.msg || "Failed to update profile");
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-[1000px] mx-auto pb-24">
            {/* Header */}
            <div className="space-y-1">
                <button 
                    onClick={() => router.push('/manage')}
                    className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Manage
                </button>
                <h1 className="text-3xl font-bold tracking-tight">Restaurant Profile</h1>
                <p className="text-muted-foreground text-sm">
                    Manage your public identity, contact details, and branding.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="w-5 h-5 text-primary" />
                            General Information
                        </CardTitle>
                        <CardDescription>
                            These details appear on your receipts and public profile.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Business Name*</Label>
                                <Input 
                                    id="name" 
                                    value={formData.name} 
                                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number*</Label>
                                <Input 
                                    id="phone" 
                                    value={formData.phone} 
                                    onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} 
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Physical Address*</Label>
                                <Input 
                                    id="address" 
                                    value={formData.address} 
                                    onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))} 
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pan_number">PAN / VAT Number</Label>
                                <Input 
                                    id="pan_number" 
                                    value={formData.pan_number} 
                                    onChange={(e) => setFormData(p => ({ ...p, pan_number: e.target.value }))} 
                                    placeholder="Company registration number"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Input 
                                    id="timezone" 
                                    value={formData.timezone} 
                                    onChange={(e) => setFormData(p => ({ ...p, timezone: e.target.value }))} 
                                    placeholder="e.g. Asia/Kathmandu"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input 
                                    id="latitude" 
                                    value={formData.latitude} 
                                    onChange={(e) => setFormData(p => ({ ...p, latitude: e.target.value }))} 
                                    placeholder="e.g. 27.7172"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input 
                                    id="longitude" 
                                    value={formData.longitude} 
                                    onChange={(e) => setFormData(p => ({ ...p, longitude: e.target.value }))} 
                                    placeholder="e.g. 85.3240"
                                />
                            </div>
                        </div>

                        <div className="p-4 border border-orange-200 bg-orange-50/30 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-orange-800 font-semibold">
                                <RefreshCw className="w-4 h-4" />
                                <h3>Local POS Server Integration</h3>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="local_pos_ip" className="text-orange-900">Local POS IP Address</Label>
                                <Input 
                                    id="local_pos_ip" 
                                    value={formData.local_pos_ip} 
                                    onChange={(e) => setFormData(p => ({ ...p, local_pos_ip: e.target.value }))} 
                                    placeholder="e.g. 192.168.1.139"
                                    className="bg-white border-orange-200 focus-visible:ring-orange-500"
                                />
                                <p className="text-[10px] text-orange-700/70">
                                    When set, customers on your local Wi-Fi will be automatically routed to this IP for faster ordering. Leave empty if using Cloud only.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Location Marker (Tap Map to Set Location)</Label>
                            <div className="h-[400px] w-full rounded-xl overflow-hidden border bg-muted relative">
                                <LocationPicker 
                                    latitude={formData.latitude} 
                                    longitude={formData.longitude} 
                                    onChange={handleLocationChange} 
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">
                                * Tip: You can also manually adjust the coordinates above. The pin will update automatically.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">About / Description</Label>
                            <Textarea 
                                id="description" 
                                value={formData.description} 
                                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} 
                                placeholder="A brief description of your restaurant"
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary" />
                            Branding & Media
                        </CardTitle>
                        <CardDescription>
                            Upload your logo and cover image.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Logo Upload */}
                            <div className="space-y-4 flex flex-col items-center">
                                <Label>Restaurant Logo</Label>
                                <div className="w-32 h-32 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-muted-foreground relative group overflow-hidden">
                                    {uploadingLogo ? (
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    ) : formData.profile_picture ? (
                                        <img 
                                            src={getImageUrl(formData.profile_picture)} 
                                            alt="Logo" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            <Store className="w-8 h-8 mb-2" />
                                            <span className="text-[10px]">1:1 Ratio</span>
                                        </>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            type="button"
                                            onClick={() => logoInputRef.current?.click()}
                                            className="cursor-pointer"
                                        >
                                            <Upload className="w-6 h-6 text-white" />
                                        </button>
                                    </div>
                                </div>
                                <Input 
                                    ref={logoInputRef}
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'logo')}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                                    {uploadingLogo ? "Uploading..." : "Change Logo"}
                                </Button>
                            </div>

                            {/* Cover Upload */}
                            <div className="space-y-4 flex-1">
                                <Label>Cover Image</Label>
                                <div className="h-40 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-muted-foreground relative group overflow-hidden">
                                    {uploadingCover ? (
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    ) : formData.cover_photo ? (
                                        <img 
                                            src={getImageUrl(formData.cover_photo)} 
                                            alt="Cover" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            <Camera className="w-8 h-8 mb-2" />
                                            <span className="text-[10px]">16:9 Landscape</span>
                                        </>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            type="button"
                                            onClick={() => coverInputRef.current?.click()}
                                            className="cursor-pointer"
                                        >
                                            <Upload className="w-6 h-6 text-white" />
                                        </button>
                                    </div>
                                </div>
                                <Input 
                                    ref={coverInputRef}
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'cover')}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                                    {uploadingCover ? "Uploading..." : "Change Cover"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.push('/manage')}>
                        Discard Changes
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={saving || !hasChanges} 
                        className={`min-w-[150px] transition-all ${hasChanges ? "bg-primary" : "bg-green-600 hover:bg-green-600 opacity-90"}`}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : hasChanges ? (
                            <Save className="w-4 h-4 mr-2" />
                        ) : (
                            <FileText className="w-4 h-4 mr-2" />
                        )}
                        {saving ? "Saving..." : hasChanges ? "Update Profile" : "Profile Saved"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
