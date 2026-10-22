"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Loader2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";

import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { RestaurantBrandingEditor } from "@/components/settings/restaurant-branding-editor";
import { Button } from "@/components/ui/button";
import { FieldInfo } from "@/components/ui/field-info";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppPhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { forwardGeocode, reverseGeocode } from "@/lib/geocode";
import LocationPicker from "@/components/manage/profile/location-picker";

function toHourMinute(value?: string | null) {
  if (!value) return "00:00";
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return "00:00";
  const hour = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const minute = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toApiBusinessDayTime(value?: string | null) {
  return `${toHourMinute(value)}:00`;
}

function normalizeRestaurantPhone(value?: string | null) {
  const phone = String(value || "").trim();
  if (!phone || phone.startsWith("+")) return phone;
  const digits = phone.replace(/\D/g, "");
  return /^9\d{9}$/.test(digits) ? `+977${digits}` : phone;
}

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  pan_number: "",
  description: "",
  profile_picture: "",
  cover_photo: "",
  timezone: "UTC",
  business_day_start_time: "00:00",
  latitude: "",
  longitude: "",
  local_pos_ip: "",
};

export function BusinessProfileWorkspace() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const fetchGlobalRestaurant = useRestaurant((state) => state.fetchRestaurant);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [initialData, setInitialData] = useState<typeof emptyForm | null>(null);
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const forwardGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const geocodeRequestIdRef = useRef(0);

  const hasChanges = initialData
    ? JSON.stringify(formData) !== JSON.stringify(initialData)
    : false;

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!user?.restaurant_id) {
        setLoading(false);
        setLoadError(true);
        return;
      }
      try {
        setLoadError(false);
        const response = await apiClient.get(
          RestaurantApis.getById(user.restaurant_id),
        );
        if (response.data.status !== "success") throw new Error("Load failed");
        const current = response.data.data;
        const data = {
          name: current.name || "",
          address: current.address || "",
          phone: normalizeRestaurantPhone(current.phone),
          pan_number: current.pan_number || "",
          description: current.description || "",
          profile_picture: current.profile_picture || "",
          cover_photo: current.cover_photo || "",
          timezone: current.timezone || "UTC",
          business_day_start_time: toHourMinute(
            current.business_day_start_time,
          ),
          latitude: current.latitude || "",
          longitude: current.longitude || "",
          local_pos_ip: current.local_pos_ip || "",
        };
        setFormData(data);
        setInitialData(data);
      } catch (error) {
        console.error("Failed to fetch restaurant", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    void fetchRestaurant();
  }, [user?.restaurant_id]);

  const handleLocationChange = useCallback((lat: string, lng: string) => {
    setFormData((previous) => ({
      ...previous,
      latitude: lat,
      longitude: lng,
    }));

    if (forwardGeocodeTimerRef.current) {
      clearTimeout(forwardGeocodeTimerRef.current);
      forwardGeocodeTimerRef.current = null;
    }
    if (reverseGeocodeTimerRef.current)
      clearTimeout(reverseGeocodeTimerRef.current);

    const requestId = ++geocodeRequestIdRef.current;
    reverseGeocodeTimerRef.current = setTimeout(async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        if (requestId !== geocodeRequestIdRef.current) return;
        if (address) setFormData((previous) => ({ ...previous, address }));
      } catch {
        // Keep the selected coordinates when reverse geocoding is unavailable.
      }
    }, 450);
  }, []);

  const handleAddressChange = useCallback((value: string) => {
    setFormData((previous) => ({ ...previous, address: value }));

    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }
    if (forwardGeocodeTimerRef.current)
      clearTimeout(forwardGeocodeTimerRef.current);
    if (value.trim().length < 8) return;

    const requestId = ++geocodeRequestIdRef.current;
    forwardGeocodeTimerRef.current = setTimeout(async () => {
      try {
        const result = await forwardGeocode(value.trim());
        if (requestId !== geocodeRequestIdRef.current || !result) return;
        setFormData((previous) => ({
          ...previous,
          latitude: result.lat,
          longitude: result.lng,
        }));
      } catch {
        // Keep the typed address when forward geocoding is unavailable.
      }
    }, 700);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasChanges) return;
    if (!user?.restaurant_id) {
      toast.error("No restaurant selected");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        business_day_start_time: toApiBusinessDayTime(
          formData.business_day_start_time,
        ),
      };
      const response = await apiClient.put(
        RestaurantApis.update(user.restaurant_id),
        payload,
      );
      if (response.data.status !== "success") {
        toast.error(response.data.message || "Failed to update profile");
        return;
      }
      setInitialData({ ...formData });
      await fetchGlobalRestaurant(true);
      toast.success("Business profile updated");
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : detail?.[0]?.msg || "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId="business_profile" />
        <main className="min-w-0 flex-1">
          <PageHeader
            className="hidden lg:flex"
            title="Business profile"
            description="Identity, contact details, location, and business-day settings."
          />

          {loading ? (
            <LoadingState label="Loading business profile" className="mt-8" />
          ) : loadError ? (
            <ErrorState
              className="mt-8"
              title="Business profile could not be loaded"
              description="Refresh the page to try loading the restaurant again."
              actionLabel="Refresh"
              onAction={() => window.location.reload()}
            />
          ) : (
            <form onSubmit={handleSubmit} className="mt-2 max-w-4xl lg:mt-7">
              <section className="border-b border-border pb-8">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">Identity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The name and images customers see on receipts and documents.
                  </p>
                </div>

                {user?.restaurant_id ? (
                  <RestaurantBrandingEditor
                    restaurantId={user.restaurant_id}
                    profilePicture={formData.profile_picture}
                    coverPhoto={formData.cover_photo}
                    onUpdated={async (field, value) => {
                      setFormData((previous) => ({
                        ...previous,
                        [field]: value,
                      }));
                      setInitialData((previous) =>
                        previous ? { ...previous, [field]: value } : previous,
                      );
                      await fetchGlobalRestaurant(true);
                    }}
                  />
                ) : null}

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Restaurant name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan_number">PAN / VAT number</Label>
                    <Input
                      id="pan_number"
                      value={formData.pan_number}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          pan_number: event.target.value,
                        }))
                      }
                      placeholder="Registration number"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      placeholder="A brief description of your restaurant"
                      rows={3}
                    />
                  </div>
                </div>
              </section>

              <section className="border-b border-border py-8">
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    Location & contact
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Contact details and the precise restaurant location.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <AppPhoneInput
                      id="phone"
                      value={formData.phone}
                      onChange={(value) =>
                        setFormData((previous) => ({
                          ...previous,
                          phone: value,
                        }))
                      }
                      defaultCountry="NP"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="address">Address</Label>
                      <FieldInfo>
                        Type an address or set the map pin. Both stay in sync.
                      </FieldInfo>
                    </div>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(event) =>
                        handleAddressChange(event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      value={formData.latitude}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          latitude: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      value={formData.longitude}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          longitude: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Map location</Label>
                    <div className="h-72 overflow-hidden rounded-xl border border-border bg-muted sm:h-80">
                      <LocationPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        onChange={handleLocationChange}
                        height={320}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="py-8">
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Clock3 className="h-5 w-5 text-muted-foreground" />
                    Operations
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Timezone and business-date boundaries used throughout Yummy.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <TimezoneSelect
                      id="timezone"
                      value={formData.timezone}
                      onChange={(timezone) =>
                        setFormData((previous) => ({
                          ...previous,
                          timezone,
                        }))
                      }
                      placeholder="Select timezone"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="business_day_start_time">
                        Business day starts
                      </Label>
                      <FieldInfo>
                        Orders before this time belong to the previous business
                        day.
                      </FieldInfo>
                    </div>
                    <Input
                      id="business_day_start_time"
                      type="time"
                      step={60}
                      value={formData.business_day_start_time}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          business_day_start_time: toHourMinute(
                            event.target.value,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={restaurant?.currency || "NPR"} disabled />
                    <p className="text-xs text-muted-foreground">
                      Currency is managed by the financial setup.
                    </p>
                  </div>
                </div>
              </section>

              <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0 lg:bottom-4 lg:rounded-xl lg:border lg:px-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasChanges || saving}
                  onClick={() => initialData && setFormData(initialData)}
                >
                  Discard
                </Button>
                <Button type="submit" disabled={!hasChanges || saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Saving" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </main>
      </div>
    </AppPage>
  );
}
