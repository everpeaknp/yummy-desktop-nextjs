"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
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
      path: "/settings/administrators",
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

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  const leave = async () => {
    if (!preflight?.can_leave) return;
    if (
      !window.confirm(
        `Leave ${restaurant?.name || "this restaurant"}? Your access ends immediately, but attendance and payroll history remain here.`,
      )
    )
      return;
    setLeaving(true);
    try {
      await apiClient.post(RestaurantJoinApis.leave);
      await refreshSession();
      await syncUserProfile();
      useRestaurant.getState().clearRestaurant();
      toast.success(
        "You left the restaurant. Your account and work history were preserved.",
      );
      window.location.assign("/onboarding");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to leave restaurant"));
      setLeaving(false);
      await loadPreflight();
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-12 pt-8 sm:px-6 sm:pt-12">
      <header className="max-w-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive"><LogOut className="h-4 w-4" />Restaurant access</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Leave {restaurant?.name || "this restaurant"}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">You will no longer be able to work in this restaurant. Your Yummy account stays active, and this restaurant&apos;s existing attendance, payroll, and audit history remains intact.</p>
      </header>

      <section className="mt-10 border-y py-5" aria-label="Leave readiness">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-semibold tracking-tight">Ready to leave?</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">We check your open responsibilities before access is removed.</p></div>
          <Button type="button" size="icon" variant="ghost" className="shrink-0" disabled={loading} onClick={() => void loadPreflight()} aria-label="Refresh readiness check" title="Refresh readiness check">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
        </div>

        <div className="mt-5">
          {loading && !preflight ? <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking ownership, drawer, and attendance</div> : null}
          {!loading && !preflight ? <div className="border-l-2 border-destructive pl-4"><p className="font-medium text-destructive">We could not verify your readiness</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Refresh the check before leaving this restaurant.</p></div> : null}
          {preflight?.can_leave ? <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-semibold">Everything is clear</p><p className="mt-1 text-sm leading-5 text-muted-foreground">You have no ownership, open drawer, or active attendance responsibilities.</p></div></div> : null}
          {preflight?.blockers?.map((blocker) => {
            const presentation = blockerPresentation(blocker);
            const Icon = presentation.icon;
            return <div key={blocker.code} className="flex items-start gap-3 border-t py-4 first:border-t-0 first:pt-0"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><p className="font-medium">{blocker.title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{blocker.detail}</p><p className="mt-2 text-sm leading-5 text-amber-800 dark:text-amber-300">{presentation.hint}</p>{presentation.path ? <Button asChild size="sm" variant="outline" className="mt-3"><Link href={presentation.path}>{presentation.action}</Link></Button> : null}</div></div>;
          })}
        </div>
      </section>

      <footer className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" disabled={leaving} onClick={() => router.back()} className="order-2 text-muted-foreground sm:order-1">Stay in restaurant</Button>
        <Button variant="destructive" className="order-1 w-full sm:order-2 sm:w-auto" disabled={loading || leaving || !preflight?.can_leave} onClick={() => void leave()}>{leaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}{leaving ? "Leaving..." : "Leave restaurant"}</Button>
      </footer>
    </main>
  );
}
