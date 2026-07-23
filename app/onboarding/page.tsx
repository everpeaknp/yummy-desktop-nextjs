"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  ChevronRight,
  Clock3,
  Loader2,
  LogOut,
  QrCode,
  ScanLine,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis, RestaurantJoinApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ImageService } from "@/services/image-service";
import { addMembershipEventListener } from "@/lib/restaurant-membership";
import { canAccessOnboarding, canReplayOnboarding } from "@/lib/onboarding";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import {
  invitationTokenFromPayload,
  PENDING_INVITATION_TOKEN_KEY,
} from "@/lib/restaurant-invitation-link";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,  
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReplay =
    searchParams.get("replay") === "1" ||
    searchParams.get("replay") === "true" ||
    searchParams.has("replay-1");
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const syncUserProfile = useAuth((state) => state.syncUserProfile);
  const refreshSession = useAuth((state) => state.refreshSession);
  const restaurantProfile = useRestaurant((state) => state.restaurant);
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
  const [invitationLinkError, setInvitationLinkError] = useState("");
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

  useEffect(() => {
    const token = invitationTokenFromPayload(
      localStorage.getItem(PENDING_INVITATION_TOKEN_KEY) || "",
    );
    if (!token) return;
    setInvitationCode(token);
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
        const linkedToken = invitationTokenFromPayload(
          localStorage.getItem(PENDING_INVITATION_TOKEN_KEY) || "",
        );
        const linkedInvitation = linkedToken
          ? rows.find((item) => item.code === linkedToken)
          : undefined;
        const orderedRows = linkedInvitation
          ? [
              linkedInvitation,
              ...rows.filter((item) => item.id !== linkedInvitation.id),
            ]
          : rows;
        setInvitations(orderedRows);
        if (linkedInvitation) {
          setInvitationCode(linkedInvitation.code);
          setInvitationLinkError("");
        } else if (linkedToken) {
          setInvitationLinkError(
            "This invitation is unavailable for the signed-in email. It may belong to another email, or it may have expired or been revoked.",
          );
        } else if (rows.length === 1) {
          setInvitationCode(rows[0].code);
        }
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
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (scanRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      // Wait for the centered dialog + video element to mount.
      let video: HTMLVideoElement | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
        if (scanRequestRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop());
          if (streamRef.current === stream) streamRef.current = null;
          return;
        }
        video = videoRef.current;
        if (video) break;
      }

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (scanRequestRef.current === requestId) setScanning(false);
        toast.error("Unable to open camera preview");
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
      if (
        invitationTokenFromPayload(
          localStorage.getItem(PENDING_INVITATION_TOKEN_KEY) || "",
        ) === selectedCode
      ) {
        localStorage.removeItem(PENDING_INVITATION_TOKEN_KEY);
      }
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
      if (
        invitationTokenFromPayload(
          localStorage.getItem(PENDING_INVITATION_TOKEN_KEY) || "",
        ) === invitation.code
      ) {
        localStorage.removeItem(PENDING_INVITATION_TOKEN_KEY);
        setInvitationLinkError("");
      }
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

  // Replay setup tour from help center / settings.
  useEffect(() => {
    if (!isReplay) return;
    void fetchRestaurant(true);
  }, [isReplay, fetchRestaurant]);

  // First registration only — after a restaurant exists, leave /onboarding unless admin replay.
  useEffect(() => {
    if (!user) return;
    const hasRestaurant = Boolean(user.restaurant_id || restaurantProfile?.id);

    if (isReplay) {
      if (!canReplayOnboarding(user)) {
        router.replace(resolvePostLoginRoute(user));
      }
      return;
    }

    if (hasRestaurant) {
      router.replace(resolvePostLoginRoute(user));
    }
  }, [user, restaurantProfile?.id, isReplay, router]);

  if (isReplay) {
    if (!canReplayOnboarding(user)) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="bg-transparent">
        <header className="relative z-30 w-full border-0 bg-transparent pb-3 pt-2 shadow-none sm:pb-4">
          <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-4 py-3 sm:px-6 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-onboarding text-lg font-medium leading-tight tracking-[-0.03em]">Yummy</p>
                <p className="text-xs leading-tight text-muted-foreground">Workspace onboarding</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="shrink-0 bg-transparent shadow-none hover:bg-transparent hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <OnboardingWizard
          initialEmail={user?.email || ""}
          replay
          restaurantId={user?.restaurant_id ?? restaurantProfile?.id ?? null}
          initialRestaurant={restaurantProfile as Record<string, unknown> | null}
          embedded
        />
      </div>
    );
  }

  // Already registered — redirect away from first-time onboarding.
  if (user?.restaurant_id || restaurantProfile?.id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mode === "create") {
    if (!canAccessOnboarding(user)) {
      return (
        <main className="bg-transparent p-4 md:p-8">
          <div className="mx-auto max-w-lg space-y-4">
            <Button variant="ghost" onClick={() => setMode("choice")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to options
            </Button>
            <Card className="rounded-3xl border-0 shadow-xl">
              <CardHeader>
                <CardTitle>Admin access required</CardTitle>
                <CardDescription>
                  Creating a restaurant is limited to admin, owner, or manager accounts. Join an existing restaurant instead.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setMode("join")}>Join a restaurant</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      );
    }

    return (
      <div className="bg-transparent">
        <header className="relative z-30 w-full border-0 bg-transparent pb-3 pt-2 shadow-none sm:pb-4">
          <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-4 py-3 sm:px-6 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-onboarding text-lg font-medium leading-tight tracking-[-0.03em]">Yummy</p>
                <p className="text-xs leading-tight text-muted-foreground">Workspace onboarding</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="shrink-0 bg-transparent shadow-none hover:bg-transparent hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <OnboardingWizard
          initialEmail={user?.email || ""}
          replay={false}
          restaurantId={user?.restaurant_id ?? null}
          initialRestaurant={null}
          onBackToOptions={() => setMode("choice")}
          embedded
        />
      </div>
    );
  }

  return (
    <main className="bg-transparent px-4 pb-4 pt-2 md:px-8 md:pb-8 md:pt-3">
      <div className="mx-auto max-w-6xl space-y-2">
        <header className="relative z-30 flex items-center justify-between border-0 bg-transparent py-2 shadow-none font-sans">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-sm font-bold text-primary">Y</span>
            </div>
            <span className="font-semibold text-foreground">Yummy</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </header>

        {mode === "choice" && (
          <section className="font-sans pt-2 pb-8 md:pt-4 md:pb-12">
            <div className="flex flex-col items-center justify-center px-2 pt-2 pb-6 md:pt-4 md:pb-10">
              <div className="mb-10 space-y-3 text-center">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Get started
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                  How would you like to get started?
                </h1>
                <p className="mx-auto max-w-md text-lg text-muted-foreground">
                  Welcome
                  {user?.full_name && !user.full_name.includes("@")
                    ? `, ${user.full_name}`
                    : ""}. Create your own workspace or request access to an existing restaurant.
                </p>
              </div>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className="group relative flex flex-col items-start overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:border-orange-400 hover:shadow-xl"
                >
                  <div className="absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 rounded-t-2xl bg-gradient-to-r from-orange-400 to-amber-500 transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rounded-full bg-orange-500/5 transition-transform duration-700 group-hover:scale-150" />

                  <div className="relative">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-orange-100 transition-transform duration-300 group-hover:scale-110 dark:bg-orange-900/30">
                      <ChefHat className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Create a restaurant</h2>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      Set up your business details, map location, timezone and business day.
                    </p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
                      Start setup
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("join")}
                  className="group relative flex flex-col items-start overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-xl"
                >
                  <div className="absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 rounded-t-2xl bg-gradient-to-r from-blue-500 to-indigo-500 transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/5 transition-transform duration-700 group-hover:scale-150" />

                  <div className="relative">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 transition-transform duration-300 group-hover:scale-110 dark:bg-blue-900/30">
                      <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Join a restaurant</h2>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      Use a restaurant code, scan its QR, or accept a verified-email invitation.
                    </p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      View join options
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              </div>

              <p className="mt-12 text-center text-xs text-muted-foreground">
                Joining never grants access until an authorized reviewer approves you.
              </p>
            </div>
          </section>
        )}

        {mode === "join" && (
          <section className="font-sans pt-2 pb-8 md:pt-4 md:pb-12">
            <div className="flex flex-col items-center justify-center px-2 pt-2 pb-6 md:pt-4 md:pb-10">
              <div className="mb-10 space-y-3 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                  Join an existing restaurant
                </h1>
                <p className="mx-auto max-w-md text-lg text-muted-foreground">
                  Your account remains unassigned until the restaurant approves your request or you
                  accept an invitation sent to your email.
                </p>
              </div>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
                <div className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-orange-400 hover:shadow-xl">
                  <div className="absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 rounded-t-2xl bg-gradient-to-r from-orange-400 to-amber-500 transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rounded-full bg-orange-500/5 transition-transform duration-700 group-hover:scale-150" />
                  <div className="relative flex h-full flex-col">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-orange-100 transition-transform duration-300 group-hover:scale-110 dark:bg-orange-900/30">
                      <QrCode className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Restaurant code or QR</h2>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      Submitting a code creates a pending request. The restaurant chooses your role
                      during approval.
                    </p>
                    <div className="mt-auto space-y-4">
                      <Input
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                        placeholder="Enter restaurant code"
                        className="h-12 border-2 text-center font-mono text-lg tracking-widest"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          disabled={joinLoading}
                          onClick={() => void requestJoin()}
                        >
                          {joinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Request access
                        </Button>
                        <Button variant="outline" className="border-2" onClick={() => void scan()}>
                          <ScanLine className="mr-2 h-4 w-4" />
                          Scan
                        </Button>
                      </div>
                      {requests.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-2xl border-2 border-border bg-background/60 p-3"
                        >
                          <StatusIcon status={item.status} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{item.restaurant_name}</p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {item.status}
                              {item.selected_role ? ` · ${item.selected_role}` : ""}
                            </p>
                          </div>
                          {item.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={busyAccessId === `request-${item.id}`}
                              onClick={() => void cancelRequest(item)}
                            >
                              {busyAccessId === `request-${item.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-xl">
                  <div className="absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 rounded-t-2xl bg-gradient-to-r from-blue-500 to-indigo-500 transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/5 transition-transform duration-700 group-hover:scale-150" />
                  <div className="relative flex h-full flex-col">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 transition-transform duration-300 group-hover:scale-110 dark:bg-blue-900/30">
                      <ShieldCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Verified email invitation</h2>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      Only an account signed in with the invited email can accept this code.
                    </p>
                    <div className="mt-auto space-y-4">
                      {invitationLinkError && (
                        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          <p className="font-semibold">Invitation could not be opened</p>
                          <p className="mt-1 text-xs leading-relaxed">
                            {invitationLinkError}
                          </p>
                        </div>
                      )}
                      {invitations.some((item) => item.code === invitationCode) && (
                        <div className="flex items-center gap-2 rounded-2xl border border-blue-300 bg-blue-50 p-3 text-sm font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                          <ShieldCheck className="h-4 w-4" />
                          Invitation opened securely from your email
                        </div>
                      )}
                      <Input
                        value={invitationCode}
                        onChange={(event) => {
                          setInvitationCode(event.target.value);
                          setInvitationLinkError("");
                        }}
                        placeholder="Invitation code from email"
                        className="h-12 border-2"
                      />
                      <Button
                        className="w-full border-2 border-blue-200 bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                        variant="secondary"
                        disabled={joinLoading}
                        onClick={() => void acceptInvitation()}
                      >
                        Accept invitation
                      </Button>
                      {invitations.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-2xl border-2 bg-background/60 p-3 ${
                            item.code === invitationCode
                              ? "border-blue-500 shadow-sm shadow-blue-500/10"
                              : "border-border"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setInvitationCode(item.code)}
                            className="w-full text-left"
                          >
                            <p className="font-semibold">{item.restaurant_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited as {item.selected_role || "staff"} · Click to use code
                            </p>
                            {item.expires_at && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Expires {new Date(item.expires_at).toLocaleDateString()}
                              </p>
                            )}
                          </button>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 border-2"
                              variant="outline"
                              onClick={() => void acceptInvitation(item.code)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={busyAccessId === `invitation-${item.id}`}
                              onClick={() => void declineInvitation(item)}
                            >
                              {busyAccessId === `invitation-${item.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Decline"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-12 text-center text-xs text-muted-foreground">
                Joining never grants access until an authorized reviewer approves you.
              </p>

              <Button
                variant="ghost"
                className="mt-6 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => {
                  stopScanner();
                  setMode("choice");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to options
              </Button>
            </div>

            <Dialog
              open={scanning}
              onOpenChange={(open) => {
                if (!open) stopScanner();
              }}
            >
              <DialogContent className="font-sans sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                    <ScanLine className="h-5 w-5 text-primary" />
                    Scan restaurant QR
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    Point your camera at the restaurant QR code. Scanning stops automatically when a
                    code is detected.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-hidden rounded-2xl border-2 border-border bg-black">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                  />
                </div>
                <Button type="button" variant="outline" className="w-full border-2" onClick={stopScanner}>
                  Cancel scanning
                </Button>
              </DialogContent>
            </Dialog>
          </section>
        )}
      </div>
    </main>
  );
}

function StatusIcon({ status }: { status: string }) {
  const approved = status === "approved";
  return <div className={`flex h-9 w-9 items-center justify-center rounded-full ${approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{approved ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div>;
}
