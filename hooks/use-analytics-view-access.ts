"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import {
  ANALYTICS_VIEW_PERMISSION,
  hasAnalyticsViewPermission,
} from "@/lib/role-permissions";

export { ANALYTICS_VIEW_PERMISSION, hasAnalyticsViewPermission };

export function useAnalyticsViewAccess() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
      setReady(true);
    };
    void checkAuth();
  }, [user, me, router]);

  const canViewAnalytics = hasAnalyticsViewPermission(user);

  return { user, ready, canViewAnalytics };
}
