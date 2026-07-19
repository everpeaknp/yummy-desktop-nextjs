"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bed,
  Camera,
  Check,
  ChefHat,
  Coffee,
  CreditCard,
  Layers,
  Loader2,
  Map,
  Maximize2,
  Minimize2,
  Moon,
  Smartphone,
  Store,
  Sun,
  Upload,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LocationPicker from "@/components/manage/profile/location-picker";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { AppPhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { FieldInfo } from "@/components/ui/field-info";
import { forwardGeocode, reverseGeocode } from "@/lib/geocode";
import apiClient from "@/lib/api-client";
import {
  RestaurantApis,
  TableApis,
  TableTypeApis,
  TaxConfigApis,
} from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn, getImageUrl } from "@/lib/utils";
import { ImageService } from "@/services/image-service";
import {
  BUSINESS_TYPE_OPTIONS,
  businessTypeLabel,
  createEmptyDraft,
  earliestOpenTime,
  markPendingTour,
  OnboardingDraft,
  PAYMENT_OPTIONS,
  PaymentMethodKey,
  paymentCardsFromSelection,
  saveOnboardingHours,
  WORKSPACE_OPTIONS,
  workspaceFlags,
  workspaceLabel,
} from "@/lib/onboarding";

function toHourMinute(value?: string | null) {
  if (!value) return "00:00";
  const match = String(value).trim().match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return "00:00";
  const hour = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const minute = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toApiBusinessDayTime(value?: string | null) {
  const normalized = toHourMinute(value);
  return `${normalized}:00`;
}

function normalizePhoneForInput(phone?: string | null) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  // Profile sometimes stores local digits; default to Nepal for onboarding sync
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("977")) return `+${digits}`;
  return `+977${digits}`;
}

function draftFromRestaurant(
  r: Record<string, unknown>,
  email: string,
  base?: OnboardingDraft
): OnboardingDraft {
  const prev = base || createEmptyDraft(email);
  const restaurantEnabled = Boolean(r.restaurant_enabled ?? true);
  const hotelEnabled = Boolean(r.hotel_enabled);
  return {
    ...prev,
    restaurantName: String(r.name || prev.restaurantName || ""),
    phone: normalizePhoneForInput(String(r.phone || prev.phone || "")),
    email: email || prev.email,
    taxNumber: String(r.pan_number || prev.taxNumber || ""),
    address: String(r.address || prev.address || ""),
    description: String(r.description || prev.description || ""),
    latitude:
      r.latitude != null && r.latitude !== "" ? String(r.latitude) : prev.latitude,
    longitude:
      r.longitude != null && r.longitude !== "" ? String(r.longitude) : prev.longitude,
    businessDayStartTime:
      toHourMinute(r.business_day_start_time as string | null | undefined) ||
      prev.businessDayStartTime,
    profilePicture: String(r.profile_picture || prev.profilePicture || ""),
    coverPhoto: String(r.cover_photo || prev.coverPhoto || ""),
    timezone: String(r.timezone || prev.timezone || "Asia/Kathmandu"),
    workspace:
      restaurantEnabled && hotelEnabled
        ? "both"
        : hotelEnabled
          ? "hotel"
          : "restaurant",
  };
}

const STEP_LABELS = [
  "Workspace",
  "Restaurant details",
  "Business type",
  "Operating hours",
  "Service setup",
  "Review and finish",
] as const;

const BUSINESS_ICONS = {
  dine_in: UtensilsCrossed,
  cafe: Coffee,
  cloud_kitchen: ChefHat,
} as const;

const WORKSPACE_ICONS = {
  restaurant: UtensilsCrossed,
  hotel: Bed,
  both: Layers,
} as const;

const PAYMENT_ICONS = {
  cash: Wallet,
  card: CreditCard,
  digital_wallet: Smartphone,
} as const;

function extractError(err: unknown): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    "Something went wrong. Please try again."
  );
}

export function OnboardingWizard({
  initialEmail = "",
  replay = false,
  restaurantId = null,
  initialRestaurant = null,
}: {
  initialEmail?: string;
  replay?: boolean;
  restaurantId?: number | null;
  initialRestaurant?: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const refreshToken = useAuth((s) => s.refreshToken);
  const setAuth = useAuth((s) => s.setAuth);
  const setRestaurant = useRestaurant((s) => s.setRestaurant);
  const setSelectedModule = useRestaurant((s) => s.setSelectedModule);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);

  const resolvedRestaurantId =
    restaurantId ?? user?.restaurant_id ?? (initialRestaurant?.id as number | undefined) ?? null;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const [locationMapMaximized, setLocationMapMaximized] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(Boolean(replay));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const email = initialEmail || "";
    if (replay && initialRestaurant) {
      return draftFromRestaurant(initialRestaurant, email);
    }
    return createEmptyDraft(email);
  });
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forwardGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestIdRef = useRef(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const prefilledRef = useRef<number | "store" | null>(null);

  // Replay: sync current restaurant profile into the form
  useEffect(() => {
    if (!replay) {
      setSyncingProfile(false);
      return;
    }

    const id = resolvedRestaurantId;
    if (!id && !initialRestaurant) {
      setSyncingProfile(false);
      return;
    }

    // Already synced this restaurant
    const alreadySynced =
      (id != null && prefilledRef.current === id) ||
      (id == null && prefilledRef.current === "store");
    if (alreadySynced) {
      setSyncingProfile(false);
      return;
    }

    let cancelled = false;
    setSyncingProfile(true);

    // Immediate sync from store so fields aren't empty while API loads
    if (initialRestaurant) {
      setDraft((prev) =>
        draftFromRestaurant(initialRestaurant, initialEmail || user?.email || "", prev)
      );
      if (!id) {
        prefilledRef.current = "store";
        setSyncingProfile(false);
        return;
      }
    }

    void (async () => {
      try {
        if (!id) return;
        const res = await apiClient.get(RestaurantApis.getById(id));
        const r = res.data?.data;
        if (!r || cancelled) return;
        setDraft((prev) =>
          draftFromRestaurant(r, initialEmail || user?.email || "", prev)
        );
        prefilledRef.current = id;
      } catch (err) {
        console.warn("[onboarding] failed to sync profile into form", err);
      } finally {
        if (!cancelled) setSyncingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    replay,
    resolvedRestaurantId,
    user?.email,
    initialEmail,
    initialRestaurant,
  ]);

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const patch = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    clearFieldError(String(key));
  };

  const fieldErrorClass = (key: string) =>
    fieldErrors[key] ? "border-destructive focus-visible:border-destructive" : undefined;

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="text-[11px] font-medium text-destructive">{fieldErrors[name]}</p>
    ) : null;

  /** Map pin moved → update coordinates + fill address */
  const handleLocationChange = useCallback((lat: string, lng: string) => {
    setDraft((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    clearFieldError("location");
    clearFieldError("address");

    if (forwardGeocodeTimerRef.current) {
      clearTimeout(forwardGeocodeTimerRef.current);
      forwardGeocodeTimerRef.current = null;
    }
    if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);

    const requestId = ++geocodeRequestIdRef.current;
    setResolvingAddress(true);
    reverseGeocodeTimerRef.current = setTimeout(async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        if (requestId !== geocodeRequestIdRef.current) return;
        if (address) {
          setDraft((prev) => ({ ...prev, address }));
        }
      } catch {
        // Keep coordinates even if address lookup fails
      } finally {
        if (requestId === geocodeRequestIdRef.current) {
          setResolvingAddress(false);
        }
      }
    }, 450);
  }, [clearFieldError]);

  /** Address typed → update pin on map */
  const handleAddressChange = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, address: value }));
    clearFieldError("address");
    clearFieldError("location");

    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }
    if (forwardGeocodeTimerRef.current) clearTimeout(forwardGeocodeTimerRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 8) {
      setResolvingAddress(false);
      return;
    }

    const requestId = ++geocodeRequestIdRef.current;
    setResolvingAddress(true);
    forwardGeocodeTimerRef.current = setTimeout(async () => {
      try {
        const result = await forwardGeocode(trimmed);
        if (requestId !== geocodeRequestIdRef.current) return;
        if (result) {
          setDraft((prev) => ({
            ...prev,
            latitude: result.lat,
            longitude: result.lng,
          }));
        }
      } catch {
        // Keep typed address even if lookup fails
      } finally {
        if (requestId === geocodeRequestIdRef.current) {
          setResolvingAddress(false);
        }
      }
    }, 700);
  }, [clearFieldError]);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    type === "logo" ? setUploadingLogo(true) : setUploadingCover(true);
    try {
      const id = resolvedRestaurantId ?? undefined;
      const publicUrl = await ImageService.uploadRestaurantImage(file, type, id);
      setDraft((prev) => ({
        ...prev,
        [type === "logo" ? "profilePicture" : "coverPhoto"]: publicUrl,
      }));
      if (id) {
        try {
          await apiClient.put(RestaurantApis.update(id), {
            [type === "logo" ? "profile_picture" : "cover_photo"]: publicUrl,
          });
        } catch (err) {
          console.warn("[onboarding] image saved to storage; profile update deferred", err);
        }
      }
      toast.success(`${type === "logo" ? "Logo" : "Cover image"} uploaded`);
    } catch (err) {
      console.error(`Failed to upload ${type}`, err);
      toast.error(`Failed to upload ${type}`);
    } finally {
      type === "logo" ? setUploadingLogo(false) : setUploadingCover(false);
      e.target.value = "";
    }
  };

  const togglePayment = (value: PaymentMethodKey) => {
    clearFieldError("payments");
    setDraft((prev) => {
      const exists = prev.payments.includes(value);
      return {
        ...prev,
        payments: exists
          ? prev.payments.filter((p) => p !== value)
          : [...prev.payments, value],
      };
    });
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (uploadingLogo || uploadingCover) {
      toast.error("Please wait for image upload to finish.");
      return false;
    }
    if (resolvingAddress) {
      toast.error("Please wait for address lookup to finish.");
      return false;
    }

    if (step === 0) {
      if (!draft.workspace) {
        errors.workspace = "Please choose a workspace.";
      }
    }

    if (step === 1) {
      if (!draft.restaurantName.trim()) {
        errors.restaurantName = "Business name is required.";
      } else if (draft.restaurantName.trim().length < 2) {
        errors.restaurantName = "Business name must be at least 2 characters.";
      }

      if (!draft.phone.trim()) {
        errors.phone = "Phone number is required.";
      } else if (!isValidPhoneNumber(draft.phone.trim())) {
        errors.phone = "Enter a valid phone number with country code.";
      }

      if (!draft.address.trim()) {
        errors.address = "Physical address is required.";
      } else if (draft.address.trim().length < 5) {
        errors.address = "Enter a fuller address (street, area, city…).";
      }

      if (!draft.timezone.trim()) {
        errors.timezone = "Timezone is required.";
      }

      if (!draft.businessDayStartTime.trim()) {
        errors.businessDayStartTime = "Business day start time is required.";
      } else if (!/^\d{2}:\d{2}$/.test(draft.businessDayStartTime.trim())) {
        errors.businessDayStartTime = "Enter a valid time.";
      }

      const lat = draft.latitude.trim();
      const lng = draft.longitude.trim();
      if ((lat && !lng) || (!lat && lng)) {
        errors.location = "Set both latitude and longitude on the map, or clear both.";
      } else if (lat && lng) {
        const latN = Number(lat);
        const lngN = Number(lng);
        if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
          errors.location = "Invalid latitude from map pin.";
        } else if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
          errors.location = "Invalid longitude from map pin.";
        }
      }
    }

    if (step === 2 && draft.workspace !== "hotel") {
      if (!draft.businessType) {
        errors.businessType = "Please select a business type.";
      }
    }

    if (step === 3) {
      const openDays = draft.hours.filter((h) => h.isOpen);
      if (openDays.length === 0) {
        errors.hours = "Open at least one day.";
      } else {
        for (const row of openDays) {
          if (!row.open || !row.close) {
            errors.hours = `Set open and close times for ${row.day}.`;
            break;
          }
          if (row.open === row.close) {
            errors.hours = `${row.day}: close time must differ from open time.`;
            break;
          }
        }
      }
    }

    if (step === 4) {
      if (!draft.currency) {
        errors.currency = "Currency is required.";
      }
      if (draft.taxRate < 0 || draft.taxRate > 100) {
        errors.taxRate = "Tax rate must be between 0 and 100.";
      }
      if (!Number.isFinite(draft.orderStart) || draft.orderStart < 1) {
        errors.orderStart = "Order numbering must start from 1 or higher.";
      }
      if (
        draft.workspace !== "hotel" &&
        draft.businessType !== "cloud_kitchen" &&
        (!Number.isFinite(draft.tables) || draft.tables < 0)
      ) {
        errors.tables = "Table count cannot be negative.";
      }
      if (
        draft.workspace !== "hotel" &&
        draft.businessType === "dine_in" &&
        draft.tables < 1
      ) {
        errors.tables = "Add at least 1 table for dine-in.";
      }
      if (!draft.payments.length) {
        errors.payments = "Select at least one payment method.";
      }
    }

    setFieldErrors(errors);
    const keys = Object.keys(errors);
    if (keys.length) {
      toast.error(errors[keys[0]]);
      return false;
    }
    return true;
  };

  const buildProfilePayload = () => {
    const name = draft.restaurantName.trim() || "My Restaurant";
    const address = draft.address.trim() || "Address not provided";
    const phone = draft.phone.trim() || "0000000000";
    const description =
      draft.description.trim() ||
      `${businessTypeLabel(draft.businessType)}${
        draft.email ? ` · ${draft.email}` : ""
      }`;
    const businessDayStart =
      draft.businessDayStartTime && draft.businessDayStartTime !== "00:00"
        ? toApiBusinessDayTime(draft.businessDayStartTime)
        : earliestOpenTime(draft.hours);
    const lat = draft.latitude.trim();
    const lng = draft.longitude.trim();

    return {
      name,
      address,
      phone,
      description,
      pan_number: draft.taxNumber.trim() || null,
      timezone: draft.timezone || "Asia/Kathmandu",
      business_day_start_time: businessDayStart,
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null,
      profile_picture: draft.profilePicture.trim() || null,
      cover_photo: draft.coverPhoto.trim() || null,
    };
  };

  const finishSetup = async (skipped: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (replay) {
        if (skipped) {
          toast.success("Returned to settings");
          router.replace("/manage");
          return;
        }

        const id = resolvedRestaurantId;
        if (!id) {
          throw new Error("No restaurant found to update.");
        }

        const flags = workspaceFlags(draft.workspace);
        const profile = buildProfilePayload();
        await apiClient.put(RestaurantApis.update(id), {
          ...profile,
          tax_enabled: draft.taxRate > 0,
          restaurant_enabled: flags.restaurant_enabled,
          hotel_enabled: flags.hotel_enabled,
          payment_cards: paymentCardsFromSelection(draft.payments),
        });

        saveOnboardingHours(draft.hours);
        await fetchRestaurant(true);
        toast.success("Restaurant profile updated");
        router.replace("/manage/profile");
        return;
      }

      const flags = workspaceFlags(draft.workspace);
      const profile = buildProfilePayload();

      const createRes = await apiClient.post(RestaurantApis.create, {
        ...profile,
        tax_enabled: draft.taxRate > 0,
        kot_enabled: true,
        restaurant_enabled: flags.restaurant_enabled,
        hotel_enabled: flags.hotel_enabled,
        payment_cards: paymentCardsFromSelection(draft.payments),
      });

      const body = createRes?.data;
      let created =
        body?.data && typeof body.data === "object" && !Array.isArray(body.data)
          ? body.data
          : body && typeof body === "object" && !Array.isArray(body) && body.id
            ? body
            : null;

      // If create response was redirected/stripped, recover via by-user profile.
      if (!created?.id) {
        await fetchRestaurant(true);
        created = useRestaurant.getState().restaurant;
      }

      if (!created?.id) {
        throw new Error(
          "Restaurant setup did not return a profile. Check API URL and try again."
        );
      }

      // Dual-module accounts must land on gateway (no pre-selected module).
      if (flags.restaurant_enabled && flags.hotel_enabled) {
        setSelectedModule(null);
      } else if (flags.hotel_enabled) {
        setSelectedModule("hotel");
      } else {
        setSelectedModule("restaurant");
      }

      setRestaurant({
        ...created,
        restaurant_enabled: flags.restaurant_enabled,
        hotel_enabled: flags.hotel_enabled,
      });
      if (user && token) {
        setAuth(
          { ...user, restaurant_id: created.id },
          token,
          refreshToken
        );
      }

      saveOnboardingHours(draft.hours);

      // Best-effort extras — do not block finishing setup
      try {
        if (flags.restaurant_enabled && draft.taxRate > 0) {
          await apiClient.post(TaxConfigApis.create, {
            name: "VAT",
            rate: Number(draft.taxRate),
            type: "percentage",
            applicable_to: "all",
            is_active: true,
            restaurant_id: created.id,
          });
        }
      } catch (err) {
        console.warn("[onboarding] tax create skipped", err);
      }

      if (
        flags.restaurant_enabled &&
        draft.businessType !== "cloud_kitchen" &&
        draft.tables > 0
      ) {
        try {
          const typeRes = await apiClient.post(TableTypeApis.createTableType(created.id), {
            name: "Main Floor",
            layout_height: 200,
          });
          const typeId = typeRes.data?.data?.id ?? typeRes.data?.id;
          if (typeId) {
            const count = Math.min(Number(draft.tables) || 0, 40);
            for (let i = 1; i <= count; i += 1) {
              await apiClient.post(TableApis.createTable(created.id), {
                name: `T${i}`,
                capacity: 4,
                table_type_id: typeId,
                status: "FREE",
                pos_x: ((i - 1) % 6) * 120,
                pos_y: Math.floor((i - 1) / 6) * 100,
              });
            }
          }
        } catch (err) {
          console.warn("[onboarding] table seed skipped", err);
        }
      }

      await fetchRestaurant(true);
      toast.success(skipped ? "Setup skipped — workspace ready" : "Restaurant setup complete");

      if (flags.restaurant_enabled && flags.hotel_enabled) {
        router.replace("/gateway");
      } else if (flags.hotel_enabled) {
        router.replace("/rooms");
      } else {
        markPendingTour();
        router.replace("/dashboard?tour=1");
      }
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (!validate()) return;
    setFieldErrors({});
    if (step < STEP_LABELS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    await finishSetup(false);
  };

  const summaryRows = useMemo(
    () => [
      { label: "Business", value: draft.restaurantName || "—" },
      { label: "Logo", value: draft.profilePicture ? "Uploaded" : "Not set" },
      { label: "Cover", value: draft.coverPhoto ? "Uploaded" : "Not set" },
      { label: "Workspace", value: workspaceLabel(draft.workspace) },
      {
        label: "Business type",
        value:
          draft.workspace === "hotel"
            ? "Hotel"
            : businessTypeLabel(draft.businessType),
      },
      { label: "Address", value: draft.address || "Not provided" },
      {
        label: "Location",
        value:
          draft.latitude && draft.longitude
            ? `${draft.latitude}, ${draft.longitude}`
            : "Not set",
      },
      {
        label: "Tables",
        value:
          draft.workspace === "hotel" || draft.businessType === "cloud_kitchen"
            ? "Not applicable"
            : String(draft.tables || 0),
      },
      { label: "Tax rate", value: `${draft.taxRate || 0}%` },
      {
        label: "Payment methods",
        value:
          draft.payments
            .map((p) => PAYMENT_OPTIONS.find((o) => o.value === p)?.title)
            .filter(Boolean)
            .join(", ") || "None selected",
      },
    ],
    [draft]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.14),transparent_45%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.08),transparent_40%)] dark:bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_40%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.08),transparent_45%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] items-center justify-center p-0 sm:p-6 md:p-8">
        <div className="grid w-full overflow-hidden rounded-none border-border bg-card shadow-2xl shadow-primary/10 sm:rounded-3xl sm:border md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr]">
          <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-8 text-primary-foreground md:block">
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white shadow-lg">
                  <Image
                    src="/logos/yummy_logo.png"
                    alt="Yummy"
                    width={36}
                    height={36}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="text-xl font-extrabold tracking-tight">Yummy</span>
              </div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
                Set up your restaurant in minutes.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80">
                Complete the essentials now. You can change everything later from settings.
              </p>

              <div className="mt-10 space-y-4">
                {STEP_LABELS.map((label, index) => {
                  const active = index === step;
                  const done = index < step;
                  return (
                    <div
                      key={label}
                      className={cn(
                        "flex items-center gap-3 transition-opacity",
                        active || done ? "opacity-100" : "opacity-55"
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-full border text-sm font-bold",
                          active && "border-transparent bg-white text-primary",
                          done && "border-transparent bg-emerald-100 text-emerald-800",
                          !active && !done && "border-white/30 bg-white/15"
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="flex min-h-[680px] flex-col p-5 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>
                    Step {step + 1} of {STEP_LABELS.length}
                  </span>
                  <span className="md:hidden">{STEP_LABELS[step]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground"
                  disabled={submitting}
                  onClick={() => void finishSetup(true)}
                >
                  {replay ? "Back to settings" : "Skip setup"}
                </Button>
              </div>
            </div>

            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {step === 0 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Workspace
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Choose your workspace
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Same choice as the gateway. Pick restaurant, hotel, or both — you can switch later.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {WORKSPACE_OPTIONS.map((option) => {
                      const Icon = WORKSPACE_ICONS[option.value];
                      const selected = draft.workspace === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => patch("workspace", option.value)}
                          className={cn(
                            "rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5",
                            selected
                              ? "border-primary bg-secondary shadow-sm"
                              : "border-border bg-card hover:border-primary/40",
                            fieldErrors.workspace && !selected && "border-destructive/60"
                          )}
                        >
                          <div
                            className={cn(
                              "mb-3 grid h-11 w-11 place-items-center rounded-xl",
                              selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="font-bold">{option.title}</div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <FieldError name="workspace" />
                </section>
              )}

              {step === 1 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Welcome
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Tell us about your restaurant
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Same details as Restaurant Profile — these appear on receipts and your public profile.
                  </p>

                  {replay && syncingProfile && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Syncing data from Restaurant Profile…
                    </div>
                  )}

                  <div className="space-y-6 rounded-2xl border border-border bg-card/40 p-5">
                    <div>
                      <div className="mb-4 flex items-center gap-2 text-sm font-bold">
                        <Camera className="h-4 w-4 text-primary" />
                        Branding &amp; media
                      </div>
                      <div className="relative mb-16 w-full rounded-xl border bg-muted/40 shadow-sm">
                        <div className="relative h-40 w-full overflow-hidden rounded-t-xl group md:h-48">
                          {uploadingCover ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          ) : draft.coverPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageUrl(draft.coverPhoto)}
                              alt="Cover"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
                              <Camera className="mb-2 h-8 w-8" />
                              <span className="text-[10px]">16:9 Landscape</span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => coverInputRef.current?.click()}
                              className="cursor-pointer rounded-full bg-white/20 p-2 backdrop-blur-sm hover:bg-white/30"
                              aria-label="Upload cover"
                            >
                              <Upload className="h-6 w-6 text-white" />
                            </button>
                          </div>
                          <Input
                            ref={coverInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => void handleImageUpload(e, "cover")}
                          />
                        </div>

                        <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
                          <div className="relative flex h-28 w-28 flex-col items-center justify-center overflow-hidden rounded-full border-4 border-background bg-background text-muted-foreground shadow-md group">
                            {uploadingLogo ? (
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            ) : draft.profilePicture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={getImageUrl(draft.profilePicture)}
                                alt="Logo"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <>
                                <Store className="mb-1 h-7 w-7" />
                                <span className="text-[10px]">1:1 Ratio</span>
                              </>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                className="cursor-pointer"
                                aria-label="Upload logo"
                              >
                                <Upload className="h-6 w-6 text-white" />
                              </button>
                            </div>
                          </div>
                          <Input
                            ref={logoInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => void handleImageUpload(e, "logo")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Store className="h-4 w-4 text-primary" />
                      General information
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="restaurantName">Business Name*</Label>
                        <Input
                          id="restaurantName"
                          value={draft.restaurantName}
                          onChange={(e) => patch("restaurantName", e.target.value)}
                          placeholder="e.g. Himalayan Grill"
                          className={fieldErrorClass("restaurantName")}
                          aria-invalid={Boolean(fieldErrors.restaurantName)}
                        />
                        <FieldError name="restaurantName" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number*</Label>
                        <AppPhoneInput
                          id="phone"
                          value={draft.phone}
                          onChange={(value) => patch("phone", value)}
                          defaultCountry="NP"
                          placeholder="Enter phone number"
                          className={fieldErrors.phone ? "[&_.PhoneInput]:border-destructive" : undefined}
                        />
                        <FieldError name="phone" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="email">Email address</Label>
                          {(draft.email || user?.email) ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              title="Verified"
                              aria-label="Verified"
                            >
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                          ) : null}
                        </div>
                        <Input
                          id="email"
                          type="email"
                          value={draft.email || user?.email || ""}
                          readOnly
                          disabled
                          className="cursor-not-allowed bg-muted/50 opacity-100"
                          placeholder="Verified account email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taxNumber">PAN / VAT Number</Label>
                        <Input
                          id="taxNumber"
                          value={draft.taxNumber}
                          onChange={(e) => patch("taxNumber", e.target.value)}
                          placeholder="Company registration number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone*</Label>
                        <TimezoneSelect
                          id="timezone"
                          value={draft.timezone}
                          onChange={(tz) => patch("timezone", tz)}
                          placeholder="Select timezone"
                          className={fieldErrorClass("timezone")}
                        />
                        <FieldError name="timezone" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="businessDayStartTime">Business Day Starts At*</Label>
                          <FieldInfo>
                            Orders before this time are counted toward the previous business day.
                          </FieldInfo>
                        </div>
                        <Input
                          id="businessDayStartTime"
                          type="time"
                          step={60}
                          value={draft.businessDayStartTime}
                          onChange={(e) =>
                            patch("businessDayStartTime", toHourMinute(e.target.value))
                          }
                          className={fieldErrorClass("businessDayStartTime")}
                          aria-invalid={Boolean(fieldErrors.businessDayStartTime)}
                        />
                        <FieldError name="businessDayStartTime" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="address">Physical Address*</Label>
                        <FieldInfo>
                          Type an address or open the map — both stay in sync. Format: street, area,
                          city, state, country.
                        </FieldInfo>
                      </div>
                      <div className="relative">
                        <Input
                          id="address"
                          value={draft.address}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          placeholder="Street, area, city, state, country"
                          className={cn("pr-11", fieldErrorClass("address"))}
                          aria-invalid={Boolean(fieldErrors.address)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-primary hover:bg-transparent hover:text-primary"
                          onClick={() => setLocationMapOpen(true)}
                          title="Set location on map"
                          aria-label="Open map to set location"
                        >
                          <Map className="h-4 w-4" />
                        </Button>
                      </div>
                      <FieldError name="address" />
                      <FieldError name="location" />
                      {resolvingAddress ? (
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Syncing address and map…
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">About / Description</Label>
                      <Textarea
                        id="description"
                        value={draft.description}
                        onChange={(e) => patch("description", e.target.value)}
                        placeholder="A brief description of your restaurant"
                        rows={4}
                      />
                    </div>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Business type
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {draft.workspace === "hotel"
                      ? "Hotel setup style"
                      : "How do you serve customers?"}
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {draft.workspace === "hotel"
                      ? "You can refine hotel operations later from rooms and settings."
                      : "Choose the option that best describes your business. You can enable more later."}
                  </p>
                  {draft.workspace === "hotel" ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                      Hotel workspace selected. Continue to set hours and essentials.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {BUSINESS_TYPE_OPTIONS.map((option) => {
                          const Icon = BUSINESS_ICONS[option.value];
                          const selected = draft.businessType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => patch("businessType", option.value)}
                              className={cn(
                                "rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5",
                                selected
                                  ? "border-primary bg-secondary shadow-sm"
                                  : "border-border bg-card hover:border-primary/40",
                                fieldErrors.businessType && !selected && "border-destructive/60"
                              )}
                            >
                              <div
                                className={cn(
                                  "mb-3 grid h-11 w-11 place-items-center rounded-xl",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-primary"
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="font-bold">{option.title}</div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      <FieldError name="businessType" />
                    </>
                  )}
                </section>
              )}

              {step === 3 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Operating hours
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    When are you open?
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    These hours help with planning. Your business day start time will use your earliest open hour.
                  </p>
                  <FieldError name="hours" />
                  <div className="space-y-3">
                    {draft.hours.map((row, index) => (
                      <div
                        key={row.day}
                        className={cn(
                          "grid grid-cols-2 items-center gap-3 rounded-xl border p-3 sm:grid-cols-[110px_1fr_1fr_auto]",
                          fieldErrors.hours ? "border-destructive/50" : "border-border"
                        )}
                      >
                        <strong className="col-span-2 text-sm sm:col-span-1">{row.day}</strong>
                        <Input
                          type="time"
                          value={row.open}
                          disabled={!row.isOpen}
                          onChange={(e) => {
                            const nextHours = [...draft.hours];
                            nextHours[index] = { ...row, open: e.target.value };
                            patch("hours", nextHours);
                          }}
                        />
                        <Input
                          type="time"
                          value={row.close}
                          disabled={!row.isOpen}
                          onChange={(e) => {
                            const nextHours = [...draft.hours];
                            nextHours[index] = { ...row, close: e.target.value };
                            patch("hours", nextHours);
                          }}
                        />
                        <div className="col-span-2 flex justify-end sm:col-span-1">
                          <Switch
                            checked={row.isOpen}
                            onCheckedChange={(checked) => {
                              const nextHours = [...draft.hours];
                              nextHours[index] = { ...row, isOpen: checked };
                              patch("hours", nextHours);
                            }}
                            aria-label={`${row.day} open`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {step === 4 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Service setup
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Configure the essentials
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Add basic operational details so your dashboard is ready to use.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {draft.workspace !== "hotel" && draft.businessType !== "cloud_kitchen" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="tables">Number of tables</Label>
                          <FieldInfo>
                            How many dine-in tables to create for floor plans and table orders. You
                            can add or remove tables later.
                          </FieldInfo>
                        </div>
                        <Input
                          id="tables"
                          type="number"
                          min={0}
                          max={40}
                          value={draft.tables}
                          onChange={(e) => patch("tables", Number(e.target.value) || 0)}
                          className={fieldErrorClass("tables")}
                          aria-invalid={Boolean(fieldErrors.tables)}
                        />
                        <FieldError name="tables" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label>Currency*</Label>
                        <FieldInfo>
                          Display preference for now — you can refine billing later in settings.
                        </FieldInfo>
                      </div>
                      <Select
                        value={draft.currency}
                        onValueChange={(value) => patch("currency", value)}
                      >
                        <SelectTrigger className={fieldErrorClass("currency")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NPR">NPR - Nepalese Rupee</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError name="currency" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="taxRate">Default tax rate (%)*</Label>
                        <FieldInfo>
                          Applied as your default tax on orders. You can add more tax rules later in
                          settings.
                        </FieldInfo>
                      </div>
                      <Input
                        id="taxRate"
                        type="number"
                        min={0}
                        max={100}
                        value={draft.taxRate}
                        onChange={(e) => patch("taxRate", Number(e.target.value) || 0)}
                        className={fieldErrorClass("taxRate")}
                        aria-invalid={Boolean(fieldErrors.taxRate)}
                      />
                      <FieldError name="taxRate" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="orderStart">Order numbering starts from*</Label>
                        <FieldInfo>
                          Saved locally as a reminder — order numbers follow your backend sequence.
                        </FieldInfo>
                      </div>
                      <Input
                        id="orderStart"
                        type="number"
                        min={1}
                        value={draft.orderStart}
                        onChange={(e) => patch("orderStart", Number(e.target.value) || 1)}
                        className={fieldErrorClass("orderStart")}
                        aria-invalid={Boolean(fieldErrors.orderStart)}
                      />
                      <FieldError name="orderStart" />
                    </div>
                    <div className="space-y-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Label>Accepted payment methods*</Label>
                        <FieldInfo>
                          Choose which payment options cashiers can use at checkout. You can change
                          these later in settings.
                        </FieldInfo>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {PAYMENT_OPTIONS.map((option) => {
                          const Icon = PAYMENT_ICONS[option.value];
                          const selected = draft.payments.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => togglePayment(option.value)}
                              className={cn(
                                "rounded-2xl border p-4 text-left transition-all",
                                selected
                                  ? "border-primary bg-secondary"
                                  : "border-border bg-card hover:border-primary/40",
                                fieldErrors.payments && !selected && "border-destructive/60"
                              )}
                            >
                              <Icon className="mb-2 h-5 w-5 text-primary" />
                              <div className="font-bold">{option.title}</div>
                            </button>
                          );
                        })}
                      </div>
                      <FieldError name="payments" />
                    </div>
                  </div>
                </section>
              )}

              {step === 5 && (
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Almost done
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Review your setup
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {draft.workspace === "both"
                      ? "After finishing you will open the gateway to choose Restaurant or Hotel."
                      : "Check the details below before opening your workspace."}
                  </p>
                  <div className="rounded-2xl border border-border bg-muted/30 p-5">
                    {summaryRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-start justify-between gap-6 border-b border-dashed border-border py-3 last:border-0"
                      >
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <strong className="max-w-[60%] text-right text-sm">{row.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold">Your workspace is ready</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      {draft.workspace === "both"
                        ? "Next stop is the gateway — pick Restaurant POS or Hotel Management."
                        : "After finishing, a short guided tour will highlight the most important dashboard options."}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="secondary"
                className={cn(step === 0 && "invisible")}
                disabled={submitting}
                onClick={() => {
                  setFieldErrors({});
                  setStep((s) => Math.max(0, s - 1));
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={submitting || uploadingLogo || uploadingCover || resolvingAddress}
                onClick={() => void next()}
                className="min-w-[140px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : step === STEP_LABELS.length - 1 ? (
                  replay ? "Done" : "Finish setup"
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </main>
        </div>
      </div>

      <Dialog
        open={locationMapOpen}
        onOpenChange={(open) => {
          setLocationMapOpen(open);
          if (!open) setLocationMapMaximized(false);
        }}
      >
        <DialogContent
          className={cn(
            "gap-3 overflow-hidden p-5",
            locationMapMaximized
              ? "flex h-[92vh] w-[96vw] max-w-[96vw] flex-col sm:max-w-[96vw]"
              : "w-[min(100%,36rem)] max-w-none sm:max-w-xl"
          )}
        >
          <div className="absolute right-11 top-3.5 z-[60] flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setLocationMapMaximized((v) => !v)}
              title={locationMapMaximized ? "Minimize map" : "Maximize map"}
              aria-label={locationMapMaximized ? "Minimize map" : "Maximize map"}
            >
              {locationMapMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogHeader className="shrink-0 space-y-1 pr-28 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Map className="h-4 w-4 text-primary" />
              Set location
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tap the map or drag the pin. Address updates automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="map-address">Physical Address*</Label>
              <FieldInfo>
                Type an address or move the pin — both stay in sync. Format: street, area, city,
                state, country.
              </FieldInfo>
            </div>
            <Input
              id="map-address"
              value={draft.address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Street, area, city, state, country"
            />
            {resolvingAddress ? (
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Syncing address and map…
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "overflow-hidden rounded-xl border bg-muted p-2.5",
              locationMapMaximized ? "flex min-h-0 flex-1 flex-col" : ""
            )}
          >
            {locationMapOpen ? (
              <LocationPicker
                key={locationMapMaximized ? "map-max" : "map-norm"}
                latitude={draft.latitude}
                longitude={draft.longitude}
                onChange={handleLocationChange}
                height={locationMapMaximized ? undefined : 220}
                className={locationMapMaximized ? "h-full min-h-[280px] flex-1" : undefined}
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 items-center gap-3 sm:justify-between">
            <p className="text-[11px] text-muted-foreground sm:text-left">
              {draft.latitude && draft.longitude
                ? `${draft.latitude}, ${draft.longitude}`
                : "No coordinates yet"}
            </p>
            <Button type="button" onClick={() => setLocationMapOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
