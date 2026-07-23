"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChefHat,
  Coffee,
  ConciergeBell,
  CreditCard,
  Loader2,
  LogOut,
  Map,
  Maximize2,
  Minimize2,
  Moon,
  QrCode,
  Smartphone,
  Soup,
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
import { useOnboarding, useOnboardingHydrated } from "@/hooks/use-onboarding";
import { useRestaurant, type Restaurant } from "@/hooks/use-restaurant";
import { cn, getImageUrl } from "@/lib/utils";
import { ImageService } from "@/services/image-service";
import {
  BUSINESS_TYPE_OPTIONS,
  businessTypeLabel,
  draftFromRestaurant,
  earliestOpenTime,
  markPendingTour,
  PAYMENT_OPTIONS,
  paymentCardsFromSelection,
  saveOnboardingHours,
  toApiBusinessDayTime,
  toHourMinute,
  WORKSPACE_OPTIONS,
  workspaceFlags,
  workspaceLabel,
} from "@/lib/onboarding";

const STEP_LABELS = [
  "Business details",
  "Workspace",
  "Operations",
  "Essentials",
  "Review",
] as const;

const BUSINESS_ICONS = {
  dine_in: UtensilsCrossed,
  cafe: Coffee,
  cloud_kitchen: ChefHat,
} as const;

const WORKSPACE_ICONS = {
  restaurant: UtensilsCrossed,
  hotel: ConciergeBell,
  both: Soup,
} as const;

const PAYMENT_ICONS = {
  cash: Wallet,
  card: CreditCard,
  digital_wallet: Smartphone,
  fonepay: QrCode,
} as const;

function extractError(err: unknown): string {
  const anyErr = err as any;
  const code = String(anyErr?.code || "");
  const message = String(anyErr?.message || "");
  if (
    code === "ECONNABORTED" ||
    /timeout/i.test(message) ||
    /timeout of \d+ms exceeded/i.test(message)
  ) {
    return "Restaurant setup is taking longer than expected. Please try Finish setup again.";
  }
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
  onBackToOptions,
  embedded = false,
}: {
  initialEmail?: string;
  replay?: boolean;
  restaurantId?: number | null;
  initialRestaurant?: Record<string, unknown> | null;
  onBackToOptions?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const refreshToken = useAuth((s) => s.refreshToken);
  const setAuth = useAuth((s) => s.setAuth);
  const logout = useAuth((s) => s.logout);
  const setRestaurant = useRestaurant((s) => s.setRestaurant);
  const setSelectedModule = useRestaurant((s) => s.setSelectedModule);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const onboardingHydrated = useOnboardingHydrated();
  const step = useOnboarding((s) => s.step);
  const draft = useOnboarding((s) => s.draft);
  const fieldErrors = useOnboarding((s) => s.fieldErrors);
  const setDraft = useOnboarding((s) => s.setDraft);
  const patch = useOnboarding((s) => s.patch);
  const togglePayment = useOnboarding((s) => s.togglePayment);
  const setFieldErrors = useOnboarding((s) => s.setFieldErrors);
  const clearFieldError = useOnboarding((s) => s.clearFieldError);
  const initSession = useOnboarding((s) => s.initSession);
  const resetOnboarding = useOnboarding((s) => s.reset);
  const nextStep = useOnboarding((s) => s.nextStep);
  const prevStep = useOnboarding((s) => s.prevStep);

  const resolvedRestaurantId =
    restaurantId ?? user?.restaurant_id ?? (initialRestaurant?.id as number | undefined) ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const [locationMapMaximized, setLocationMapMaximized] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(Boolean(replay));
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forwardGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestIdRef = useRef(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const prefilledRef = useRef<number | "store" | null>(null);
  const sessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onboardingHydrated) return;
    const key = `${replay ? "replay" : "create"}:${user?.id ?? "anon"}`;
    if (sessionKeyRef.current === key) return;
    sessionKeyRef.current = key;
    initSession({
      userId: user?.id ?? null,
      email: initialEmail || user?.email || "",
      replay,
      restaurant: replay ? initialRestaurant : null,
    });
  }, [
    onboardingHydrated,
    user?.id,
    user?.email,
    initialEmail,
    replay,
    initialRestaurant,
    initSession,
  ]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "auto";
    body.style.overflow = "auto";
    body.style.position = "";
    body.style.height = "";
    body.style.top = "";
    body.style.width = "";
    body.style.pointerEvents = "";
    body.removeAttribute("data-scroll-locked");
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Replay: sync current restaurant profile into the form
  useEffect(() => {
    if (!replay || !onboardingHydrated) {
      if (!replay) setSyncingProfile(false);
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
    onboardingHydrated,
    resolvedRestaurantId,
    user?.email,
    initialEmail,
    initialRestaurant,
    setDraft,
  ]);

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

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

    if (step === 1) {
      if (!draft.workspace) {
        errors.workspace = "Please choose a workspace.";
      }
    }

    if (step === 2) {
      if (draft.workspace !== "hotel" && !draft.businessType) {
        errors.businessType = "Please select a business type.";
      }

      if (!draft.timezone.trim()) {
        errors.timezone = "Timezone is required.";
      }

      if (!draft.businessDayStartTime.trim()) {
        errors.businessDayStartTime = "Business day start time is required.";
      } else if (!/^\d{2}:\d{2}$/.test(draft.businessDayStartTime.trim())) {
        errors.businessDayStartTime = "Enter a valid time.";
      }
    }

    if (step === 3) {
      if (!draft.currency) {
        errors.currency = "Currency is required.";
      }
      if (draft.taxEnabled && (draft.taxRate < 0 || draft.taxRate > 100)) {
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
    // First registration must complete every step — skip is replay-only ("Back to settings").
    if (!replay && skipped) return;
    setSubmitting(true);
    try {
      if (replay) {
        if (skipped) {
          resetOnboarding(initialEmail || user?.email || "");
          toast.success("Returned to dashboard");
          router.replace("/dashboard");
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
          tax_enabled: draft.taxEnabled,
          kot_enabled: draft.kotEnabled,
          restaurant_enabled: flags.restaurant_enabled,
          hotel_enabled: flags.hotel_enabled,
          payment_cards: paymentCardsFromSelection(draft.payments),
        });

        try {
          const templateResponse = await apiClient.get(RestaurantApis.getTemplates(id));
          const receiptTemplate = (templateResponse.data?.data?.receipt_template || []) as Array<
            Record<string, unknown>
          >;
          const configured = receiptTemplate.map((block) => {
            if (block.type === "header") {
              return {
                ...block,
                show_logo: draft.receiptShowLogo,
                show_pan: draft.receiptShowPan,
              };
            }
            if (block.type === "footer") {
              return { ...block, message: draft.receiptFooter.trim() };
            }
            return block;
          });
          await apiClient.put(RestaurantApis.updateTemplates(id), {
            receipt_template: configured,
          });
        } catch (err) {
          console.warn("[onboarding] receipt template update skipped", err);
        }

        saveOnboardingHours(draft.hours);
        await fetchRestaurant(true);
        resetOnboarding(initialEmail || user?.email || "");
        toast.success("Restaurant profile updated");
        router.replace("/manage/profile");
        return;
      }

      const flags = workspaceFlags(draft.workspace);
      const profile = buildProfilePayload();

      const openWorkspace = async (
        created: Pick<Restaurant, "id" | "restaurant_enabled" | "hotel_enabled"> &
          Partial<Restaurant>
      ) => {
        const restaurantEnabled =
          Boolean(created.restaurant_enabled) || flags.restaurant_enabled;
        const hotelEnabled = Boolean(created.hotel_enabled) || flags.hotel_enabled;

        // Land on dashboard after finish. Dual-module defaults to restaurant POS.
        if (!restaurantEnabled && hotelEnabled) {
          setSelectedModule("hotel");
        } else {
          setSelectedModule("restaurant");
        }

        setRestaurant({
          ...(created as any),
          restaurant_enabled: restaurantEnabled,
          hotel_enabled: hotelEnabled,
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
          if (restaurantEnabled && draft.taxEnabled && draft.taxRate > 0) {
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

        try {
          const templateResponse = await apiClient.get(RestaurantApis.getTemplates(created.id));
          const receiptTemplate = (templateResponse.data?.data?.receipt_template || []) as Array<
            Record<string, unknown>
          >;
          const configured = receiptTemplate.map((block) => {
            if (block.type === "header") {
              return {
                ...block,
                show_logo: draft.receiptShowLogo,
                show_pan: draft.receiptShowPan,
              };
            }
            if (block.type === "footer") {
              return { ...block, message: draft.receiptFooter.trim() };
            }
            return block;
          });
          await apiClient.put(RestaurantApis.updateTemplates(created.id), {
            receipt_template: configured,
          });
        } catch (err) {
          console.warn("[onboarding] receipt template update skipped", err);
        }

        if (
          restaurantEnabled &&
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
        resetOnboarding(initialEmail || user?.email || "");
        toast.success(skipped ? "Setup skipped — workspace ready" : "Restaurant setup complete");

        if (!restaurantEnabled && hotelEnabled) {
          router.replace("/rooms");
          return;
        }
        markPendingTour();
        router.replace("/dashboard?tour=1");
      };

      // If a previous create already succeeded (timeout / retry), open that workspace.
      if (user?.restaurant_id || useRestaurant.getState().restaurant?.id) {
        await fetchRestaurant(true);
        const existing = useRestaurant.getState().restaurant;
        if (existing?.id) {
          await openWorkspace(existing);
          return;
        }
      }

      // Restaurant create seeds defaults + accounting; allow longer than the global 30s timeout.
      let createRes;
      try {
        createRes = await apiClient.post(
          RestaurantApis.create,
          {
            ...profile,
            tax_enabled: draft.taxEnabled,
            kot_enabled: draft.kotEnabled,
            restaurant_enabled: flags.restaurant_enabled,
            hotel_enabled: flags.hotel_enabled,
            payment_cards: paymentCardsFromSelection(draft.payments),
          },
          { timeout: 120_000 }
        );
      } catch (createErr) {
        const msg = extractError(createErr);
        if (
          /already have a restaurant|leave your current restaurant|creating another/i.test(
            msg
          )
        ) {
          await fetchRestaurant(true);
          const existing = useRestaurant.getState().restaurant;
          if (existing?.id) {
            await openWorkspace(existing);
            return;
          }
        }
        throw createErr;
      }

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

      await openWorkspace(created as Restaurant);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (!validate()) return;
    if (step < STEP_LABELS.length - 1) {
      nextStep();
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
      {
        label: "Tax",
        value: draft.taxEnabled ? `${draft.taxRate || 0}%` : "Disabled",
      },
      { label: "Kitchen tickets", value: draft.kotEnabled ? "On" : "Off" },
      {
        label: "Receipt",
        value: [
          draft.receiptShowLogo ? "Logo" : null,
          draft.receiptShowPan ? "PAN" : null,
          draft.receiptFooter.trim() || null,
        ]
          .filter(Boolean)
          .join(" · ") || "Defaults",
      },
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

  if (!onboardingHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative w-full bg-transparent">
      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 pb-16 pt-4 sm:px-6 md:px-8">
        <div className="grid w-full items-stretch overflow-hidden rounded-2xl bg-card shadow-2xl shadow-primary/10 sm:rounded-3xl md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className="relative hidden h-auto min-h-full self-stretch overflow-hidden p-7 text-white md:block"
            style={{
              backgroundImage:
                "linear-gradient(165deg, #FF6A00 0%, #FF4E12 48%, #FF3D2E 100%)",
            }}
          >
            {/* Soft depth — clean premium wash, no clutter */}
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(ellipse 70% 55% at 100% 100%, rgba(0,0,0,0.12), transparent 50%)",
              }}
            />

            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-8 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                  <Image
                    src="/logos/yummy_logo.png"
                    alt="Yummy"
                    width={36}
                    height={36}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="font-onboarding text-xl font-medium tracking-[-0.03em] text-white">Yummy</span>
              </div>
              <h1 className="font-onboarding text-2xl font-medium leading-[1.15] tracking-[-0.03em] text-white lg:text-[2rem]">
                Set up your business in minutes.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Complete the essentials now. You can change everything later from settings.
              </p>

              <nav className="mt-8 space-y-2.5" aria-label="Onboarding steps">
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
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-medium",
                          active && "border-transparent bg-white text-[#FF4E12]",
                          done && "border-transparent bg-white/95 text-emerald-700",
                          !active && !done && "border-white/35 bg-white/10 text-white"
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <span className="text-sm font-medium leading-snug text-white">{label}</span>
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="flex h-full min-w-0 flex-col bg-card">
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                  <span className="tabular-nums">
                    Step {step + 1} of {STEP_LABELS.length}
                  </span>
                  <span className="truncate md:hidden">{STEP_LABELS[step]}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-28">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {(replay || onBackToOptions) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                    disabled={submitting}
                    onClick={() => {
                      if (replay) {
                        router.replace("/dashboard");
                        return;
                      }
                      onBackToOptions?.();
                    }}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    {replay ? "Back to dashboard" : "Back to options"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-500"
                  onClick={() => {
                    logout();
                    router.replace("/");
                  }}
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <div className="pb-8">
              {step === 0 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Business details
                  </p>
                  <h2 className="font-onboarding text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Tell us about your business
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Business name, contact, and address — these appear on receipts and your public profile.
                  </p>

                  {replay && syncingProfile && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Syncing data from Restaurant Profile…
                    </div>
                  )}

                  <div className="space-y-6 overflow-visible rounded-2xl border border-border bg-card/40 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
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

              {step === 1 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Workspace
                  </p>
                  <h2 className="font-onboarding text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Brand your business and choose a workspace
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Upload your logo and cover, then pick restaurant, hotel, or both — you can switch later.
                  </p>

                  <div className="mb-8 overflow-visible rounded-2xl border border-border bg-card/40 p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <Camera className="h-4 w-4 text-primary" />
                      Branding &amp; media
                    </div>
                    <div className="relative mb-14 w-full rounded-xl border border-border bg-muted/30 shadow-sm sm:mb-16">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="group relative flex h-40 w-full flex-col items-center justify-center overflow-hidden rounded-t-xl text-muted-foreground transition hover:bg-muted/50 md:h-52"
                        aria-label="Upload cover"
                      >
                        {uploadingCover ? (
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : draft.coverPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getImageUrl(draft.coverPhoto)}
                            alt="Cover"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            <Camera className="mb-2 h-8 w-8" />
                            <span className="text-sm font-medium text-foreground">Add cover photo</span>
                            <span className="mt-1 text-[10px]">16:9 landscape</span>
                          </>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                        <Input
                          ref={coverInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => void handleImageUpload(e, "cover")}
                        />
                      </button>

                      <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="group relative flex h-28 w-28 flex-col items-center justify-center overflow-hidden rounded-full border-4 border-background bg-background text-muted-foreground shadow-md transition hover:border-primary/30 sm:h-32 sm:w-32"
                          aria-label="Upload logo"
                        >
                          {uploadingLogo ? (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          ) : draft.profilePicture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageUrl(draft.profilePicture)}
                              alt="Logo"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              <Store className="mb-1 h-7 w-7" />
                              <span className="text-[10px]">Logo 1:1</span>
                            </>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <Upload className="h-5 w-5 text-white" />
                          </div>
                          <Input
                            ref={logoInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => void handleImageUpload(e, "logo")}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-3 sm:items-stretch">
                    {WORKSPACE_OPTIONS.map((option) => {
                      const Icon = WORKSPACE_ICONS[option.value];
                      const selected = draft.workspace === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => patch("workspace", option.value)}
                          className={cn(
                            "flex h-full flex-col items-center rounded-2xl border p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm",
                            selected
                              ? "border-primary bg-secondary shadow-sm ring-1 ring-primary/20"
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
                          <div className="font-medium">{option.title}</div>
                          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <FieldError name="workspace" />
                </section>
              )}

              {step === 2 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Operations
                  </p>
                  <h2 className="font-onboarding text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    {draft.workspace === "hotel"
                      ? "Set your hotel schedule and timezone"
                      : "Set schedule and how you serve"}
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {draft.workspace === "hotel"
                      ? "Timezone and business day start for hotel operations. You can refine rooms and settings later."
                      : "Timezone, business day start, and service style — dine-in, cafe, or cloud kitchen. Change anytime in settings."}
                  </p>

                  <div className="mb-7 grid gap-4 sm:grid-cols-2">
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

                  {draft.workspace === "hotel" ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                      Hotel workspace selected. Continue to configure the remaining essentials.
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
                              <div className="font-medium">{option.title}</div>
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Essentials
                  </p>
                  <h2 className="font-onboarding text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Configure payments and operations
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Tables, currency, tax, receipts, and accepted payment methods for checkout.
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
                        disabled={!draft.taxEnabled}
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

                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      <div className="divide-y divide-border rounded-2xl border border-border">
                        <div className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="font-medium text-foreground">Tax calculation</p>
                            <FieldInfo>Allow configured taxes on eligible bills.</FieldInfo>
                          </div>
                          <Switch
                            checked={draft.taxEnabled}
                            onCheckedChange={(checked) => patch("taxEnabled", checked)}
                            aria-label="Tax calculation"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="font-medium text-foreground">Kitchen tickets</p>
                            <FieldInfo>Create KOTs for food preparation.</FieldInfo>
                          </div>
                          <Switch
                            checked={draft.kotEnabled}
                            onCheckedChange={(checked) => patch("kotEnabled", checked)}
                            aria-label="Kitchen tickets"
                          />
                        </div>
                      </div>
                      <div className="divide-y divide-border rounded-2xl border border-border">
                        <div className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="font-medium text-foreground">Logo on receipt</p>
                            <FieldInfo>Use your brand in the receipt header.</FieldInfo>
                          </div>
                          <Switch
                            checked={draft.receiptShowLogo}
                            onCheckedChange={(checked) => patch("receiptShowLogo", checked)}
                            aria-label="Logo on receipt"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="font-medium text-foreground">PAN on receipt</p>
                            <FieldInfo>Show the tax registration number.</FieldInfo>
                          </div>
                          <Switch
                            checked={draft.receiptShowPan}
                            onCheckedChange={(checked) => patch("receiptShowPan", checked)}
                            aria-label="PAN on receipt"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="receiptFooter">Receipt footer</Label>
                      <Input
                        id="receiptFooter"
                        value={draft.receiptFooter}
                        onChange={(e) => patch("receiptFooter", e.target.value)}
                        placeholder="Thank you for dining with us."
                      />
                    </div>

                    <div className="space-y-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Label>Accepted payment methods*</Label>
                        <FieldInfo>
                          Choose which payment options cashiers can use at checkout. You can change
                          these later in settings.
                        </FieldInfo>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                              <div className="font-medium">{option.title}</div>
                            </button>
                          );
                        })}
                      </div>
                      <FieldError name="payments" />
                    </div>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Review
                  </p>
                  <h2 className="font-onboarding text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Review your business setup
                  </h2>
                  <p className="mt-2 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Confirm the details below, then finish to open your dashboard.
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
                    <h3 className="text-lg font-medium">Your workspace is ready</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      After finishing, you will open the dashboard
                      {draft.workspace === "both"
                        ? " (Restaurant POS). You can switch to Hotel anytime from the sidebar."
                        : ", and a short guided tour will highlight the most important options."}
                    </p>
                  </div>
                </section>
              )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <Button
                type="button"
                variant="secondary"
                className={cn(step === 0 && "invisible")}
                disabled={submitting}
                onClick={() => prevStep()}
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
