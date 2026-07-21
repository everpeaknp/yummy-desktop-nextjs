"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantJoinApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeaveRestaurantPage() {
  const router = useRouter();
  const syncUserProfile = useAuth((s) => s.syncUserProfile);
  const [leaving, setLeaving] = useState(false);
  const leave = async () => {
    if (!confirm("Leave this restaurant? Your access ends immediately, but attendance and payroll history will be preserved.")) return;
    setLeaving(true);
    try {
      await apiClient.post(RestaurantJoinApis.leave);
      await syncUserProfile();
      useRestaurant.getState().clearRestaurant();
      window.location.assign("/onboarding");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to leave restaurant"));
      setLeaving(false);
    }
  };
  return <div className="mx-auto flex min-h-[70vh] max-w-xl items-center p-6"><Card className="w-full border-destructive/40"><CardHeader><CardTitle>Leave restaurant</CardTitle><CardDescription>You will return to onboarding and may request another restaurant. Historical work records are not deleted.</CardDescription></CardHeader><CardContent className="flex gap-3"><Button variant="outline" onClick={() => router.back()}>Cancel</Button><Button variant="destructive" disabled={leaving} onClick={() => void leave()}>{leaving ? "Leaving…" : "Leave restaurant"}</Button></CardContent></Card></div>;
}
