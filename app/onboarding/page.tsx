"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  Loader2,
  LocateFixed,
  LogOut,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis, RestaurantJoinApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
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
};
type Invitation = {
  id: number;
  restaurant_name: string;
  selected_role?: string | null;
  code: string;
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
};

const steps = ["Business details", "Location & hours", "Review"];

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
  const [restaurant, setRestaurant] = useState<RestaurantDraft>({
    name: "",
    address: "",
    phone: "",
    description: "",
    latitude: "",
    longitude: "",
    timezone: browserTimezone,
    business_day_start_time: "00:00",
  });

  const [joinCode, setJoinCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [joinLoading, setJoinLoading] = useState(false);
  const [refreshingAccess, setRefreshingAccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanRequestRef = useRef(0);
  const refreshingAccessRef = useRef(false);

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

  const refreshAccessOptions = useCallback(async () => {
    if (refreshingAccessRef.current) return;
    refreshingAccessRef.current = true;
    setRefreshingAccess(true);
    try {
      const [requestResult, invitationResult] = await Promise.allSettled([
        apiClient.get(RestaurantJoinApis.myRequests),
        apiClient.get(RestaurantJoinApis.myInvitations),
      ]);
      if (requestResult.status === "fulfilled") {
        const rows = (requestResult.value.data?.data || []) as RequestItem[];
        setRequests(rows);
        if (rows.some((item) => item.status === "approved")) {
          await syncUserProfile();
          if (useAuth.getState().user?.restaurant_id) {
            await fetchRestaurant(true);
            window.location.assign("/dashboard");
            return;
          }
        }
      }
      if (invitationResult.status === "fulfilled") {
        const rows = (invitationResult.value.data?.data || []) as Invitation[];
        setInvitations(rows);
        if (rows.length === 1) setInvitationCode(rows[0].code);
      }
    } finally {
      refreshingAccessRef.current = false;
      setRefreshingAccess(false);
    }
  }, [fetchRestaurant, syncUserProfile]);

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
    const refresh = () => void refreshAccessOptions();
    const interval = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [mode, refreshAccessOptions, user?.restaurant_id]);

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
    setCreating(true);
    try {
      await apiClient.post(RestaurantApis.create, {
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
        payment_cards: [],
      });
      await Promise.all([syncUserProfile(), fetchRestaurant(true)]);
      toast.success("Restaurant created. Your workspace is ready.");
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

  const acceptInvitation = async () => {
    if (!invitationCode.trim()) {
      return toast.error("Enter the invitation code from your email");
    }
    setJoinLoading(true);
    try {
      await apiClient.post(RestaurantJoinApis.acceptInvitation, {
        code: invitationCode.trim(),
      });
      await Promise.all([syncUserProfile(), fetchRestaurant(true)]);
      toast.success("Invitation accepted");
      window.location.assign("/dashboard");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to accept invitation"));
    } finally {
      setJoinLoading(false);
    }
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
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between"><Label htmlFor="description">About the business *</Label><span className="text-xs text-muted-foreground">{restaurant.description.length}/200</span></div>
                        <Textarea id="description" rows={4} maxLength={200} value={restaurant.description} onChange={(event) => updateRestaurant("description", event.target.value)} placeholder="Tell us about your cuisine, service and atmosphere…" className={fieldClass(Boolean(errors.description))} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
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
                  <div className="space-y-7">
                    <div><h2 className="text-xl font-bold">Review your restaurant</h2><p className="mt-1 text-sm text-muted-foreground">Confirm the setup details. PAN, branding, tax and KOT preferences remain available in restaurant settings after creation.</p></div>
                    <div className="rounded-2xl border bg-muted/25 p-5">
                      <h3 className="font-bold">Restaurant details</h3>
                      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                        <ReviewItem label="Business" value={restaurant.name} />
                        <ReviewItem label="Phone" value={restaurant.phone} />
                        <ReviewItem label="Address" value={restaurant.address} />
                        <ReviewItem label="Timezone" value={restaurant.timezone} />
                        <ReviewItem label="Business day" value={restaurant.business_day_start_time} />
                        <ReviewItem label="Map pin" value={restaurant.latitude && restaurant.longitude ? `${restaurant.latitude}, ${restaurant.longitude}` : "Not set"} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />You will receive administrator access for this restaurant.</div>
                  </div>
                )}

                <div className="mt-10 flex items-center justify-between border-t pt-6">
                  <Button variant="outline" disabled={step === 0 || creating} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>
                  {step < steps.length - 1 ? <Button onClick={nextStep}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button size="lg" disabled={creating} onClick={() => void createRestaurant()}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Create restaurant</Button>}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {mode === "join" && (
          <section className="mx-auto max-w-5xl pb-12">
            <Button variant="ghost" className="mb-4" onClick={() => { stopScanner(); setMode("choice"); }}><ArrowLeft className="mr-2 h-4 w-4" />Back to options</Button>
            <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-black">Join an existing restaurant</h1><p className="mt-2 text-muted-foreground">Your account remains unassigned until the restaurant approves your request or you accept an invitation sent to {user?.email}.</p></div><Button variant="outline" disabled={refreshingAccess} onClick={() => void refreshAccessOptions()}>{refreshingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh status</Button></div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />Restaurant code or QR</CardTitle><CardDescription>Submitting a code creates a pending request. The restaurant chooses your role during approval.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Enter restaurant code" className="h-12 text-center font-mono text-lg tracking-widest" /><div className="flex gap-2"><Button className="flex-1" disabled={joinLoading} onClick={() => void requestJoin()}>{joinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request access</Button><Button variant="outline" onClick={() => void scan()}><ScanLine className="mr-2 h-4 w-4" />Scan</Button></div>{scanning && <div className="space-y-2"><video ref={videoRef} className="aspect-video w-full rounded-xl bg-black" muted playsInline /><Button variant="ghost" className="w-full" onClick={stopScanner}>Cancel scanning</Button></div>}{requests.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border p-3"><StatusIcon status={item.status} /><div><p className="font-semibold">{item.restaurant_name}</p><p className="text-xs capitalize text-muted-foreground">{item.status}{item.selected_role ? ` · ${item.selected_role}` : ""}</p></div></div>)}</CardContent></Card>
              <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" />Verified email invitation</CardTitle><CardDescription>Only an account signed in with the invited email can accept this code.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={invitationCode} onChange={(event) => setInvitationCode(event.target.value)} placeholder="Invitation code from email" className="h-12" /><Button className="w-full" variant="secondary" disabled={joinLoading} onClick={() => void acceptInvitation()}>Accept invitation</Button>{invitations.map((item) => <button type="button" key={item.id} onClick={() => setInvitationCode(item.code)} className="w-full rounded-xl border p-3 text-left transition hover:border-primary"><p className="font-semibold">{item.restaurant_name}</p><p className="text-xs text-muted-foreground">Invited as {item.selected_role || "staff"} · Click to use code</p></button>)}</CardContent></Card>
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

function StatusIcon({ status }: { status: string }) {
  const approved = status === "approved";
  return <div className={`flex h-9 w-9 items-center justify-center rounded-full ${approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{approved ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div>;
}
