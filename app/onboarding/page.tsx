"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import {
  ArrowLeft,
  ArrowRight,
  Banknote as BanknoteIcon,
  Building2,
  Camera,
  Check,
  Clock3,
  CreditCard,
  FileText,
  Hotel,
  ImageIcon,
  Loader2,
  LocateFixed,
  LogOut,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis, RestaurantJoinApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ImageService } from "@/services/image-service";
import { addMembershipEventListener } from "@/lib/restaurant-membership";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const LocationPicker = dynamic(
  () => import("@/components/manage/profile/location-picker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  },
);

type OnboardingMode = "choice" | "create" | "join";
type RequestItem = {
  id: number;
  restaurant_name: string;
  status: string;
  selected_role?: string | null;
  created_at?: string;
};
type Invitation = {
  id: number;
  restaurant_name: string;
  selected_role?: string | null;
  code: string;
  status?: string;
  expires_at?: string;
};

type RestaurantDraft = {
  name: string;
  address: string;
  phone: string;
  description: string;
  latitude: string;
  longitude: string;
  timezone: string;
  business_day_start_time: string;
  pan_number: string;
  kot_enabled: boolean;
  tax_enabled: boolean;
  restaurant_enabled: boolean;
  hotel_enabled: boolean;
  accept_cash: boolean;
  accept_card: boolean;
  accept_qr: boolean;
  card_name: string;
  card_identifier: string;
  qr_name: string;
  qr_payload: string;
  receipt_show_logo: boolean;
  receipt_show_pan: boolean;
  receipt_footer: string;
};

const steps = ["Business & brand", "Location & hours", "Operations", "Review"];
const draftVersion = 1;

function draftKey(userId?: number) {
  return userId ? `yummy:onboarding-draft:v${draftVersion}:${userId}` : null;
}

function codeFromPayload(value: string) {
  try {
    return new URL(value).searchParams.get("code") || value.trim();
  } catch {
    return value.trim();
  }
}

function fieldClass(hasError: boolean) {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const syncUserProfile = useAuth((state) => state.syncUserProfile);
  const refreshSession = useAuth((state) => state.refreshSession);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const [mode, setMode] = useState<OnboardingMode>("choice");
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [restaurant, setRestaurant] = useState<RestaurantDraft>({
    name: "",
    address: "",
    phone: "",
    description: "",
    latitude: "",
    longitude: "",
    timezone: browserTimezone,
    business_day_start_time: "00:00",
    pan_number: "",
    kot_enabled: true,
    tax_enabled: true,
    restaurant_enabled: true,
    hotel_enabled: false,
    accept_cash: true,
    accept_card: false,
    accept_qr: false,
    card_name: "Card terminal",
    card_identifier: "",
    qr_name: "Digital payment",
    qr_payload: "",
    receipt_show_logo: true,
    receipt_show_pan: true,
    receipt_footer: "Thank you for dining with us.",
  });

  const [joinCode, setJoinCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [joinLoading, setJoinLoading] = useState(false);
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanRequestRef = useRef(0);
  const refreshingAccessRef = useRef(false);
  const enteringWorkspaceRef = useRef(false);
  const logoPreviewRef = useRef("");
  const coverPreviewRef = useRef("");

  const updateRestaurant = <K extends keyof RestaurantDraft>(
    field: K,
    value: RestaurantDraft[K],
  ) => {
    setRestaurant((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const enterRestaurantWorkspace = useCallback(async () => {
    if (enteringWorkspaceRef.current) return false;
    enteringWorkspaceRef.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await refreshSession();
          await syncUserProfile();
          if (useAuth.getState().user?.restaurant_id) {
            await fetchRestaurant(true);
            window.location.assign("/dashboard");
            return true;
          }
        } catch {
          // The membership transaction or refreshed token may still be propagating.
        }
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (2 ** attempt)));
        }
      }
      return false;
    } finally {
      enteringWorkspaceRef.current = false;
    }
  }, [fetchRestaurant, refreshSession, syncUserProfile]);

  const selectBrandFile = (
    file: File | undefined,
    kind: "logo" | "cover",
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep branding images under 5 MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    if (kind === "logo") {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = preview;
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
      coverPreviewRef.current = preview;
      setCoverFile(file);
      setCoverPreview(preview);
    }
  };

  useEffect(() => {
    const key = draftKey(user?.id);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as {
          restaurant?: Partial<RestaurantDraft>;
          step?: number;
          mode?: OnboardingMode;
        };
        if (saved.restaurant) {
          setRestaurant((current) => ({ ...current, ...saved.restaurant }));
        }
        if (saved.mode === "create") setMode("create");
        if (typeof saved.step === "number") {
          setStep(Math.min(Math.max(saved.step, 0), steps.length - 1));
        }
      }
    } catch {
      localStorage.removeItem(key);
    } finally {
      setDraftReady(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!draftReady || mode !== "create") return;
    const key = draftKey(user?.id);
    if (!key) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({ mode, step, restaurant }));
      setDraftSavedAt(new Date());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftReady, mode, restaurant, step, user?.id]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")?.trim()
      || localStorage.getItem("yummy:pending-join-code")?.trim();
    if (!code) return;
    const normalizedCode = codeFromPayload(code).toUpperCase();
    localStorage.setItem("yummy:pending-join-code", normalizedCode);
    setJoinCode(normalizedCode);
    setMode("join");
  }, []);

  const refreshAccessOptions = useCallback(async () => {
    if (refreshingAccessRef.current) return;
    refreshingAccessRef.current = true;
    try {
      const [requestResult, invitationResult] = await Promise.allSettled([
        apiClient.get(RestaurantJoinApis.myRequests),
        apiClient.get(RestaurantJoinApis.myInvitations),
      ]);
      if (requestResult.status === "fulfilled") {
        const rows = (requestResult.value.data?.data || []) as RequestItem[];
        setRequests(rows);
        if (rows.some((item) => item.status === "approved")) {
          if (await enterRestaurantWorkspace()) return;
        }
      }
      if (invitationResult.status === "fulfilled") {
        const rows = (invitationResult.value.data?.data || []) as Invitation[];
        setInvitations(rows);
        if (rows.length === 1) setInvitationCode(rows[0].code);
      }
    } finally {
      refreshingAccessRef.current = false;
    }
  }, [enterRestaurantWorkspace]);

  const stopScanner = useCallback(() => {
    scanRequestRef.current += 1;
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    void refreshAccessOptions();
    return stopScanner;
  }, [refreshAccessOptions, stopScanner]);

  useEffect(() => {
    if (mode !== "join" || user?.restaurant_id) return;
    return addMembershipEventListener((detail) => {
      if (detail.payload.user_id && detail.payload.user_id !== user?.id) return;
      if (detail.event === "join_request.approved") {
        toast.success("Your restaurant access was approved");
        void enterRestaurantWorkspace();
      } else if (detail.event === "invitation.accepted") {
        void enterRestaurantWorkspace();
      }
    });
  }, [enterRestaurantWorkspace, mode, user?.id, user?.restaurant_id]);

  useEffect(() => {
    if (mode !== "join" || user?.restaurant_id) return;
    const recheck = () => {
      if (document.visibilityState === "visible") void refreshAccessOptions();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [mode, refreshAccessOptions, user?.restaurant_id]);

  useEffect(() => () => {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
  }, []);

  const validateStep = (targetStep: number) => {
    const next: Record<string, string> = {};
    if (targetStep === 0) {
      if (restaurant.name.trim().length < 2) {
        next.name = "Enter your restaurant name";
      }
      if (restaurant.phone.trim().length < 7) {
        next.phone = "Enter a valid business phone";
      }
      if (!restaurant.description.trim()) {
        next.description = "Tell staff and guests about your business";
      } else if (restaurant.description.trim().length > 200) {
        next.description = "Keep the description under 200 characters";
      }
    }
    if (targetStep === 1) {
      if (!restaurant.address.trim()) next.address = "Address is required";
      if (!restaurant.timezone.trim()) {
        next.timezone = "Timezone is required";
      } else if (!isValidTimezone(restaurant.timezone.trim())) {
        next.timezone = "Use a valid IANA timezone, such as Asia/Kathmandu";
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(restaurant.business_day_start_time)) {
        next.business_day_start_time = "Choose a valid start time";
      }
      if (
        (restaurant.latitude && !restaurant.longitude) ||
        (!restaurant.latitude && restaurant.longitude)
      ) {
        next.location = "Choose both latitude and longitude";
      }
    }
    if (targetStep === 2) {
      if (!restaurant.restaurant_enabled && !restaurant.hotel_enabled) {
        next.modules = "Enable at least one business module";
      }
      if (!restaurant.accept_cash && !restaurant.accept_card && !restaurant.accept_qr) {
        next.payment_methods = "Choose at least one payment method";
      }
      if (restaurant.accept_card && restaurant.card_name.trim().length < 2) {
        next.card_name = "Name the card terminal or provider";
      }
      if (restaurant.accept_qr && restaurant.qr_name.trim().length < 2) {
        next.qr_name = "Name the QR payment provider";
      }
      if (restaurant.accept_qr && !restaurant.qr_payload.trim()) {
        next.qr_payload = "Paste the payment QR payload or merchant link";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Complete the highlighted fields before continuing");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestaurant((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          timezone: browserTimezone,
        }));
        setLocating(false);
        toast.success("Map pin updated to your current location");
      },
      () => {
        setLocating(false);
        toast.error("We could not access your current location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleLocationChange = useCallback((latitude: string, longitude: string) => {
    setRestaurant((current) => ({ ...current, latitude, longitude }));
    setErrors((current) => {
      if (!current.location) return current;
      const next = { ...current };
      delete next.location;
      return next;
    });
  }, []);

  const createRestaurant = async () => {
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    setCreating(true);
    try {
      const createResponse = await apiClient.post(RestaurantApis.create, {
        name: restaurant.name.trim(),
        address: restaurant.address.trim(),
        phone: restaurant.phone.trim(),
        description: restaurant.description.trim(),
        ...(restaurant.latitude && restaurant.longitude
          ? {
              latitude: Number(restaurant.latitude),
              longitude: Number(restaurant.longitude),
            }
          : {}),
        timezone: restaurant.timezone.trim(),
        business_day_start_time: `${restaurant.business_day_start_time}:00`,
        pan_number: restaurant.pan_number.trim() || undefined,
        kot_enabled: restaurant.kot_enabled,
        tax_enabled: restaurant.tax_enabled,
        restaurant_enabled: restaurant.restaurant_enabled,
        hotel_enabled: restaurant.hotel_enabled,
        payment_cards: restaurant.accept_card
          ? [{
              name: restaurant.card_name.trim(),
              identifier: restaurant.card_identifier.trim() || undefined,
            }]
          : [],
        payment_qrs: restaurant.accept_qr
          ? [{ name: restaurant.qr_name.trim(), payload: restaurant.qr_payload.trim() }]
          : [],
      });
      let restaurantId = Number(createResponse.data?.data?.id);
      await refreshSession();
      await syncUserProfile();
      if (!restaurantId) restaurantId = Number(useAuth.getState().user?.restaurant_id);

      const setupWarnings: string[] = [];
      if (restaurantId && (logoFile || coverFile)) {
        const branding: Record<string, string> = {};
        const uploads = await Promise.allSettled([
          logoFile
            ? ImageService.uploadRestaurantImage(logoFile, "logo", restaurantId)
            : Promise.resolve(null),
          coverFile
            ? ImageService.uploadRestaurantImage(coverFile, "cover", restaurantId)
            : Promise.resolve(null),
        ]);
        if (uploads[0].status === "fulfilled" && uploads[0].value) {
          branding.profile_picture = uploads[0].value;
        } else if (logoFile) setupWarnings.push("logo");
        if (uploads[1].status === "fulfilled" && uploads[1].value) {
          branding.cover_photo = uploads[1].value;
        } else if (coverFile) setupWarnings.push("cover photo");
        if (Object.keys(branding).length) {
          await apiClient.patch(RestaurantApis.update(restaurantId), branding);
        }
      }

      if (restaurantId) {
        try {
          const templateResponse = await apiClient.get(RestaurantApis.getTemplates(restaurantId));
          const receiptTemplate = (templateResponse.data?.data?.receipt_template || []) as Array<Record<string, unknown>>;
          const configured = receiptTemplate.map((block) => {
            if (block.type === "header") {
              return {
                ...block,
                show_logo: restaurant.receipt_show_logo,
                show_pan: restaurant.receipt_show_pan,
              };
            }
            if (block.type === "footer") {
              return { ...block, message: restaurant.receipt_footer.trim() };
            }
            return block;
          });
          await apiClient.put(RestaurantApis.updateTemplates(restaurantId), {
            receipt_template: configured,
          });
        } catch {
          setupWarnings.push("receipt preferences");
        }
      }

      await fetchRestaurant(true);
      const key = draftKey(user?.id);
      if (key) localStorage.removeItem(key);
      toast.success("Restaurant created. Your workspace is ready.");
      if (setupWarnings.length) {
        toast.warning(`Restaurant created, but ${setupWarnings.join(" and ")} need attention in Settings.`);
      }
      window.location.assign("/dashboard");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to create restaurant"));
    } finally {
      setCreating(false);
    }
  };

  const requestJoin = async (raw = joinCode) => {
    const code = codeFromPayload(raw);
    if (!code) return toast.error("Enter or scan a restaurant code");
    setJoinLoading(true);
    try {
      await apiClient.post(RestaurantJoinApis.request, { code });
      localStorage.removeItem("yummy:pending-join-code");
      toast.success("Request sent for restaurant approval");
      setJoinCode("");
      await refreshAccessOptions();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to send request"));
    } finally {
      setJoinLoading(false);
    }
  };

  const scan = async () => {
    stopScanner();
    const requestId = scanRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (scanRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setScanning(true);
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      const video = videoRef.current;
      if (!video || scanRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (scanRequestRef.current === requestId) setScanning(false);
        return;
      }
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      scanTimerRef.current = window.setInterval(() => {
        if (!context || video.readyState < 2) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height);
        if (!result?.data) return;
        stopScanner();
        void requestJoin(result.data);
      }, 250);
    } catch {
      if (scanRequestRef.current !== requestId) return;
      stopScanner();
      toast.error("Camera access is unavailable");
    }
  };

  const acceptInvitation = async (codeOverride?: string) => {
    const selectedCode = (codeOverride || invitationCode).trim();
    if (!selectedCode) {
      return toast.error("Enter the invitation code from your email");
    }
    setJoinLoading(true);
    try {
      await apiClient.post(RestaurantJoinApis.acceptInvitation, {
        code: selectedCode,
      });
      toast.success("Invitation accepted");
      await enterRestaurantWorkspace();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to accept invitation"));
    } finally {
      setJoinLoading(false);
    }
  };

  const cancelRequest = async (request: RequestItem) => {
    setBusyAccessId(`request-${request.id}`);
    try {
      await apiClient.post(RestaurantJoinApis.cancelRequest(request.id));
      setRequests((current) => current.map((item) => (
        item.id === request.id ? { ...item, status: "cancelled" } : item
      )));
      toast.success("Join request cancelled");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to cancel this request"));
    } finally {
      setBusyAccessId(null);
    }
  };

  const declineInvitation = async (invitation: Invitation) => {
    setBusyAccessId(`invitation-${invitation.id}`);
    try {
      await apiClient.post(RestaurantJoinApis.declineInvitation(invitation.id));
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (invitationCode === invitation.code) setInvitationCode("");
      toast.success("Invitation declined");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to decline this invitation"));
    } finally {
      setBusyAccessId(null);
    }
  };

  const discardDraft = () => {
    const key = draftKey(user?.id);
    if (key) localStorage.removeItem(key);
    window.location.reload();
  };

  const signOut = () => {
    logout();
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">Yummy</p>
              <p className="text-xs text-muted-foreground">Workspace onboarding</p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </header>

        {mode === "choice" && (
          <section className="mx-auto max-w-5xl py-8 md:py-16">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Store className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                How would you like to get started?
              </h1>
              <p className="mt-4 text-base text-muted-foreground md:text-lg">
                Welcome, {user?.full_name || user?.email}. Create your own workspace or request access to an existing restaurant.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="group rounded-3xl border bg-card p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Building2 className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold">Create a restaurant</h2>
                <p className="mt-2 text-muted-foreground">
                  Set up your business details, map location, timezone and business day.
                </p>
                <span className="mt-7 flex items-center font-semibold text-primary">
                  Start setup <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                className="group rounded-3xl border bg-card p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                  <Users className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold">Join a restaurant</h2>
                <p className="mt-2 text-muted-foreground">
                  Use a restaurant code, scan its QR, or accept a verified-email invitation.
                </p>
                <span className="mt-7 flex items-center font-semibold text-blue-600">
                  View join options <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </button>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Joining never grants access until an authorized reviewer approves you.
            </div>
          </section>
        )}

        {mode === "create" && (
          <section className="mx-auto max-w-5xl pb-12">
            <Button variant="ghost" className="mb-4" onClick={() => setMode("choice")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to options
            </Button>
            <Card className="overflow-hidden rounded-3xl border-0 shadow-2xl">
              <div className="border-b bg-muted/30 px-6 py-6 md:px-10">
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm font-semibold text-primary">Step {step + 1} of {steps.length}</p>
                    <h1 className="mt-1 text-2xl font-black md:text-3xl">Let&apos;s set up your restaurant</h1>
                    <p className="mt-2 text-muted-foreground">{steps[step]}</p>
                  </div>
                  <div className="flex min-w-64 gap-2">
                    {steps.map((label, index) => (
                      <div key={label} className="flex-1">
                        <div className={`h-2 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
                        <p className={`mt-2 hidden text-xs md:block ${index === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <CardContent className="p-6 md:p-10">
                {step === 0 && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-xl font-bold">Business profile</h2>
                      <p className="mt-1 text-sm text-muted-foreground">These details identify your business throughout Yummy and on receipts.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="restaurant-name">Restaurant name *</Label>
                        <Input id="restaurant-name" autoFocus value={restaurant.name} onChange={(event) => updateRestaurant("name", event.target.value)} placeholder="e.g. Yummy Bistro" className={fieldClass(Boolean(errors.name))} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-phone">Business phone *</Label>
                        <Input id="business-phone" type="tel" value={restaurant.phone} onChange={(event) => updateRestaurant("phone", event.target.value)} placeholder="e.g. +977 98XXXXXXXX" className={fieldClass(Boolean(errors.phone))} />
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pan-number">PAN / VAT number</Label>
                        <Input id="pan-number" value={restaurant.pan_number} onChange={(event) => updateRestaurant("pan_number", event.target.value)} placeholder="Optional tax registration number" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between"><Label htmlFor="description">About the business *</Label><span className="text-xs text-muted-foreground">{restaurant.description.length}/200</span></div>
                        <Textarea id="description" rows={4} maxLength={200} value={restaurant.description} onChange={(event) => updateRestaurant("description", event.target.value)} placeholder="Tell us about your cuisine, service and atmosphere…" className={fieldClass(Boolean(errors.description))} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div><Label>Restaurant branding</Label><p className="mt-1 text-xs text-muted-foreground">Optional now; both can be changed later. Image files are uploaded only when you create the restaurant.</p></div>
                        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                          <label className="group flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted/20 text-center transition hover:border-primary/50 hover:bg-primary/5">
                            {logoPreview ? <div className="h-28 w-28 rounded-2xl bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${logoPreview})` }} /> : <><ImageIcon className="h-7 w-7 text-primary" /><span className="mt-2 text-sm font-semibold">Add logo</span><span className="text-xs text-muted-foreground">Square works best</span></>}
                            <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectBrandFile(event.target.files?.[0], "logo")} />
                          </label>
                          <label className="group flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted/20 text-center transition hover:border-primary/50 hover:bg-primary/5">
                            {coverPreview ? <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage: `url(${coverPreview})` }} /> : <><Camera className="h-7 w-7 text-primary" /><span className="mt-2 text-sm font-semibold">Add cover photo</span><span className="text-xs text-muted-foreground">Landscape, up to 5 MB</span></>}
                            <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectBrandFile(event.target.files?.[0], "cover")} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-7">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div><h2 className="text-xl font-bold">Location and business clock</h2><p className="mt-1 text-sm text-muted-foreground">Pin the correct location so timezone-sensitive orders and reports stay accurate.</p></div>
                      <Button variant="outline" onClick={useCurrentLocation} disabled={locating}>{locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}Use current location</Button>
                    </div>
                    <div className="space-y-2"><Label htmlFor="address">Restaurant address *</Label><div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="address" value={restaurant.address} onChange={(event) => updateRestaurant("address", event.target.value)} placeholder="Street, city, district" className={`pl-9 ${fieldClass(Boolean(errors.address))}`} /></div>{errors.address && <p className="text-xs text-destructive">{errors.address}</p>}</div>
                    <LocationPicker latitude={restaurant.latitude} longitude={restaurant.longitude} onChange={handleLocationChange} />
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="timezone">Timezone *</Label><Input id="timezone" value={restaurant.timezone} onChange={(event) => updateRestaurant("timezone", event.target.value)} className={fieldClass(Boolean(errors.timezone))} /><p className="text-xs text-muted-foreground">Detected from this browser. Use an IANA timezone such as Asia/Kathmandu.</p>{errors.timezone && <p className="text-xs text-destructive">{errors.timezone}</p>}</div>
                      <div className="space-y-2"><Label htmlFor="business-day"><Clock3 className="mr-1 inline h-4 w-4" />Business day starts at *</Label><Input id="business-day" type="time" value={restaurant.business_day_start_time} onChange={(event) => updateRestaurant("business_day_start_time", event.target.value)} className={fieldClass(Boolean(errors.business_day_start_time))} /><p className="text-xs text-muted-foreground">Orders before this time count toward the previous business day.</p>{errors.business_day_start_time && <p className="text-xs text-destructive">{errors.business_day_start_time}</p>}</div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8">
                    <div><h2 className="text-xl font-bold">Choose how you operate</h2><p className="mt-1 text-sm text-muted-foreground">Start with sensible defaults. Every choice remains editable in Settings.</p></div>

                    <section className="space-y-3">
                      <div><h3 className="font-semibold">Business modules</h3><p className="text-sm text-muted-foreground">Enable the workspaces your team will use.</p></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleCard icon={UtensilsCrossed} title="Restaurant POS" description="Tables, orders, kitchen and billing" checked={restaurant.restaurant_enabled} onChange={(checked) => updateRestaurant("restaurant_enabled", checked)} />
                        <ToggleCard icon={Hotel} title="Hotel" description="Rooms, stays and hotel operations" checked={restaurant.hotel_enabled} onChange={(checked) => updateRestaurant("hotel_enabled", checked)} />
                      </div>
                      {errors.modules && <p className="text-xs text-destructive">{errors.modules}</p>}
                    </section>

                    <section className="space-y-3">
                      <div><h3 className="font-semibold">Payments</h3><p className="text-sm text-muted-foreground">Choose the methods available when settling a bill.</p></div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <ToggleCard icon={BanknoteIcon} title="Cash" description="Cash drawer payments" checked={restaurant.accept_cash} onChange={(checked) => updateRestaurant("accept_cash", checked)} compact />
                        <ToggleCard icon={CreditCard} title="Card" description="Terminal or card provider" checked={restaurant.accept_card} onChange={(checked) => updateRestaurant("accept_card", checked)} compact />
                        <ToggleCard icon={QrCode} title="QR / digital" description="Static merchant QR" checked={restaurant.accept_qr} onChange={(checked) => updateRestaurant("accept_qr", checked)} compact />
                      </div>
                      {errors.payment_methods && <p className="text-xs text-destructive">{errors.payment_methods}</p>}
                      {restaurant.accept_card && <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2"><div className="space-y-2"><Label>Card provider *</Label><Input value={restaurant.card_name} onChange={(event) => updateRestaurant("card_name", event.target.value)} placeholder="e.g. Visa / terminal 1" className={fieldClass(Boolean(errors.card_name))} />{errors.card_name && <p className="text-xs text-destructive">{errors.card_name}</p>}</div><div className="space-y-2"><Label>Terminal identifier</Label><Input value={restaurant.card_identifier} onChange={(event) => updateRestaurant("card_identifier", event.target.value)} placeholder="Optional merchant or terminal ID" /></div></div>}
                      {restaurant.accept_qr && <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2"><div className="space-y-2"><Label>QR provider *</Label><Input value={restaurant.qr_name} onChange={(event) => updateRestaurant("qr_name", event.target.value)} placeholder="e.g. Fonepay" className={fieldClass(Boolean(errors.qr_name))} />{errors.qr_name && <p className="text-xs text-destructive">{errors.qr_name}</p>}</div><div className="space-y-2"><Label>Merchant payload or link *</Label><Input value={restaurant.qr_payload} onChange={(event) => updateRestaurant("qr_payload", event.target.value)} placeholder="Paste the QR contents" className={fieldClass(Boolean(errors.qr_payload))} />{errors.qr_payload && <p className="text-xs text-destructive">{errors.qr_payload}</p>}</div></div>}
                    </section>

                    <section className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">Tax calculation</h3><p className="text-sm text-muted-foreground">Allow configured taxes on eligible bills.</p></div><Switch checked={restaurant.tax_enabled} onCheckedChange={(checked) => updateRestaurant("tax_enabled", checked)} /></div>
                        <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">Kitchen tickets</h3><p className="text-sm text-muted-foreground">Create KOTs for food preparation.</p></div><Switch checked={restaurant.kot_enabled} onCheckedChange={(checked) => updateRestaurant("kot_enabled", checked)} /></div>
                      </div>
                      <div className="space-y-3 rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">Logo on receipt</h3><p className="text-sm text-muted-foreground">Use your brand in the receipt header.</p></div><Switch checked={restaurant.receipt_show_logo} onCheckedChange={(checked) => updateRestaurant("receipt_show_logo", checked)} /></div>
                        <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">PAN on receipt</h3><p className="text-sm text-muted-foreground">Show the tax registration number.</p></div><Switch checked={restaurant.receipt_show_pan} onCheckedChange={(checked) => updateRestaurant("receipt_show_pan", checked)} /></div>
                      </div>
                      <div className="space-y-2 lg:col-span-2"><Label htmlFor="receipt-footer">Receipt footer</Label><Input id="receipt-footer" value={restaurant.receipt_footer} onChange={(event) => updateRestaurant("receipt_footer", event.target.value)} maxLength={100} placeholder="A short thank-you message" /></div>
                    </section>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-7">
                    <div><h2 className="text-xl font-bold">Review your restaurant</h2><p className="mt-1 text-sm text-muted-foreground">Confirm the essentials before Yummy builds your workspace.</p></div>
                    <div className="rounded-2xl border bg-muted/25 p-5">
                      <h3 className="font-bold">Restaurant details</h3>
                      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                        <ReviewItem label="Business" value={restaurant.name} />
                        <ReviewItem label="Phone" value={restaurant.phone} />
                        <ReviewItem label="Address" value={restaurant.address} />
                        <ReviewItem label="Timezone" value={restaurant.timezone} />
                        <ReviewItem label="Business day" value={restaurant.business_day_start_time} />
                        <ReviewItem label="Map pin" value={restaurant.latitude && restaurant.longitude ? `${restaurant.latitude}, ${restaurant.longitude}` : "Not set"} />
                        <ReviewItem label="PAN / VAT" value={restaurant.pan_number || "Not set"} />
                        <ReviewItem label="Modules" value={[restaurant.restaurant_enabled && "Restaurant", restaurant.hotel_enabled && "Hotel"].filter(Boolean).join(" + ")} />
                        <ReviewItem label="Payments" value={[restaurant.accept_cash && "Cash", restaurant.accept_card && "Card", restaurant.accept_qr && "QR"].filter(Boolean).join(", ")} />
                        <ReviewItem label="Operations" value={`${restaurant.tax_enabled ? "Tax on" : "Tax off"} · ${restaurant.kot_enabled ? "KOT on" : "KOT off"}`} />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-4"><FileText className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold">Receipt preference</p><p className="text-sm text-muted-foreground">{restaurant.receipt_show_logo ? "Logo shown" : "No logo"} · {restaurant.receipt_show_pan ? "PAN shown" : "PAN hidden"} · {restaurant.receipt_footer || "No custom footer"}</p></div></div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />You will receive administrator access for this restaurant.</div>
                  </div>
                )}

                <div className="mt-10 flex items-center justify-between border-t pt-6">
                  <div className="flex items-center gap-2"><Button variant="outline" disabled={step === 0 || creating} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button><Button variant="ghost" className="text-muted-foreground" disabled={creating} onClick={discardDraft}><Trash2 className="mr-2 h-4 w-4" />Discard draft</Button></div>
                  {step < steps.length - 1 ? <Button onClick={nextStep}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button size="lg" disabled={creating} onClick={() => void createRestaurant()}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Create restaurant</Button>}
                </div>
                {draftSavedAt && <p className="mt-3 text-right text-xs text-muted-foreground">Draft saved locally at {draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Branding files are uploaded only at creation.</p>}
              </CardContent>
            </Card>
          </section>
        )}

        {mode === "join" && (
          <section className="mx-auto max-w-5xl pb-12">
            <Button variant="ghost" className="mb-4" onClick={() => { stopScanner(); setMode("choice"); }}><ArrowLeft className="mr-2 h-4 w-4" />Back to options</Button>
            <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-black">Join an existing restaurant</h1><p className="mt-2 text-muted-foreground">Your account remains unassigned until the restaurant approves your request or you accept an invitation sent to {user?.email}.</p></div><div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live status updates</div></div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />Restaurant code or QR</CardTitle><CardDescription>Submitting a code creates a pending request. The restaurant chooses your role during approval.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Enter restaurant code" className="h-12 text-center font-mono text-lg tracking-widest" /><div className="flex gap-2"><Button className="flex-1" disabled={joinLoading} onClick={() => void requestJoin()}>{joinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request access</Button><Button variant="outline" onClick={() => void scan()}><ScanLine className="mr-2 h-4 w-4" />Scan</Button></div>{scanning && <div className="space-y-2"><video ref={videoRef} className="aspect-video w-full rounded-xl bg-black" muted playsInline /><Button variant="ghost" className="w-full" onClick={stopScanner}>Cancel scanning</Button></div>}{requests.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><StatusIcon status={item.status} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.restaurant_name}</p><p className="text-xs capitalize text-muted-foreground">{item.status}{item.selected_role ? ` · ${item.selected_role}` : ""}</p></div>{item.status === "pending" && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={busyAccessId === `request-${item.id}`} onClick={() => void cancelRequest(item)}>{busyAccessId === `request-${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}</Button>}</div>)}</CardContent></Card>
              <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" />Verified email invitation</CardTitle><CardDescription>Only an account signed in with the invited email can accept this code.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={invitationCode} onChange={(event) => setInvitationCode(event.target.value)} placeholder="Invitation code from email" className="h-12" /><Button className="w-full" variant="secondary" disabled={joinLoading} onClick={() => void acceptInvitation()}>Accept invitation</Button>{invitations.map((item) => <div key={item.id} className="rounded-xl border bg-card p-3"><button type="button" onClick={() => setInvitationCode(item.code)} className="w-full text-left"><p className="font-semibold">{item.restaurant_name}</p><p className="text-xs text-muted-foreground">Invited as {item.selected_role || "staff"} · Click to use code</p>{item.expires_at && <p className="mt-1 text-xs text-muted-foreground">Expires {new Date(item.expires_at).toLocaleDateString()}</p>}</button><div className="mt-3 flex gap-2"><Button size="sm" className="flex-1" variant="outline" onClick={() => void acceptInvitation(item.code)}>Accept</Button><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={busyAccessId === `invitation-${item.id}`} onClick={() => void declineInvitation(item)}>{busyAccessId === `invitation-${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}</Button></div></div>)}</CardContent></Card>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1">{value || "—"}</p></div>;
}

function ToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${checked ? "border-primary/50 bg-primary/5 shadow-sm" : "bg-card hover:border-primary/30"}`}><div className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? "h-9 w-9" : "h-11 w-11"} ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className={compact ? "h-4 w-4" : "h-5 w-5"} /></div><div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div><div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>{checked && <Check className="h-3 w-3" />}</div></button>;
}

function StatusIcon({ status }: { status: string }) {
  const approved = status === "approved";
  return <div className={`flex h-9 w-9 items-center justify-center rounded-full ${approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{approved ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div>;
}
