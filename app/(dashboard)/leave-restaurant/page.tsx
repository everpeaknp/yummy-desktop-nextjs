"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantJoinApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LeaveBlocker = {
  code: string;
  title: string;
  detail: string;
  resolution_path?: string | null;
  action_label?: string | null;
};

type LeavePreflight = {
  can_leave: boolean;
  blockers: LeaveBlocker[];
  owner_transfer_required?: boolean;
  open_drawer?: boolean;
  open_attendance?: boolean;
};

function blockerPresentation(blocker: LeaveBlocker) {
  const code = blocker.code.toLowerCase();
  if (code.includes("owner")) {
    return {
      icon: ShieldCheck,
      path: "/manage/additional-settings?setting=admin_management",
      action: blocker.action_label || "Transfer ownership",
      hint: "Choose another active administrator as owner, then return here.",
    };
  }
  if (code.includes("drawer") || code.includes("cash")) {
    return {
      icon: Banknote,
      path: blocker.resolution_path || "/cash-drawers",
      action: blocker.action_label || "Close cash drawer",
      hint: "Count and close your active drawer so its cash remains accountable.",
    };
  }
  if (code.includes("attendance") || code.includes("clock")) {
    return {
      icon: Clock3,
      path: blocker.resolution_path || "/attendance",
      action: blocker.action_label || "Clock out",
      hint: "End the open attendance entry before leaving this workplace.",
    };
  }
  return {
    icon: AlertTriangle,
    path: blocker.resolution_path || null,
    action: blocker.action_label || "Resolve blocker",
    hint: "Resolve this requirement and refresh the check.",
  };
}

export default function LeaveRestaurantPage() {
  const router = useRouter();
  const restaurant = useRestaurant((state) => state.restaurant);
  const refreshSession = useAuth((state) => state.refreshSession);
  const syncUserProfile = useAuth((state) => state.syncUserProfile);
  const [preflight, setPreflight] = useState<LeavePreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const loadPreflight = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(RestaurantJoinApis.leavePreflight);
      setPreflight(response.data?.data as LeavePreflight);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to check leave readiness"));
      setPreflight(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPreflight(); }, [loadPreflight]);

  const leave = async () => {
    if (!preflight?.can_leave) return;
    if (!window.confirm(`Leave ${restaurant?.name || "this restaurant"}? Your access ends immediately, but attendance and payroll history remain here.`)) return;
    setLeaving(true);
    try {
      await apiClient.post(RestaurantJoinApis.leave);
      await refreshSession();
      await syncUserProfile();
      useRestaurant.getState().clearRestaurant();
      toast.success("You left the restaurant. Your account and work history were preserved.");
      window.location.assign("/onboarding");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to leave restaurant"));
      setLeaving(false);
      await loadPreflight();
    }
  };

  return <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center p-4 sm:p-6">
    <Card className="w-full overflow-hidden rounded-3xl shadow-sm">
      <div className="border-b bg-gradient-to-br from-amber-500/10 via-background to-primary/10 p-6 sm:p-8">
        <Button variant="ghost" className="mb-5 -ml-3" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700"><LogOut className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold tracking-tight">Leave {restaurant?.name || "restaurant"}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">This removes only your current restaurant access. Your Yummy account and this restaurant&apos;s historical attendance, payroll, and audit records remain intact.</p></div></div>
      </div>
      <CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>Readiness check</CardTitle><CardDescription>Complete every open responsibility before access is released.</CardDescription></div><Button size="sm" variant="outline" disabled={loading} onClick={() => void loadPreflight()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}<span className={loading ? "sr-only" : ""}>Refresh</span></Button></div></CardHeader>
      <CardContent className="space-y-5">
        {loading && !preflight ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking ownership, drawers, and attendance...</div> : null}
        {!loading && !preflight ? <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-semibold text-destructive">Readiness could not be verified</p><p className="mt-1 text-muted-foreground">Refresh the check before attempting to leave.</p></div> : null}
        {preflight?.can_leave ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-semibold text-emerald-800 dark:text-emerald-300">Ready to leave</p><p className="mt-1 text-sm text-muted-foreground">No ownership, open-drawer, or clock-in responsibilities are blocking this change.</p></div></div> : null}
        {preflight?.blockers?.map((blocker) => { const presentation = blockerPresentation(blocker); const Icon = presentation.icon; return <div key={blocker.code} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-amber-500/15 p-2 text-amber-700"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{blocker.title}</p><p className="mt-1 text-sm text-muted-foreground">{blocker.detail}</p><p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">Next: {presentation.hint}</p>{presentation.path && <Button asChild size="sm" variant="outline" className="mt-3"><Link href={presentation.path}>{presentation.action}</Link></Button>}</div></div></div>; })}
        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"><Button variant="outline" disabled={leaving} onClick={() => router.back()}>Keep membership</Button><Button variant="destructive" disabled={loading || leaving || !preflight?.can_leave} onClick={() => void leave()}>{leaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}{leaving ? "Leaving..." : "Leave restaurant"}</Button></div>
      </CardContent>
    </Card>
  </div>;
}
