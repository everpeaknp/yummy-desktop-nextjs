"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRolesForUser,
  isRouteAllowedMulti,
  getHomeRouteForUser,
} from "@/lib/role-permissions";
import { Loader2, ShieldAlert } from "lucide-react";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const userPermissionsKey = useAuth((state) =>
    state.user?.permissions?.slice().sort().join("|") ?? ""
  );
  const token = useAuth((state) => state.token);
  const me = useAuth((state) => state.me);
  const logout = useAuth((state) => state.logout);
  const setRedirecting = useAuth((state) => state.setRedirecting);
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );
  const [sessionWaitExpired, setSessionWaitExpired] = useState(false);

  const SESSION_WAIT_MS = 10000;

  // Restore session on mount if we have a token but no user
  useEffect(() => {
    if (token && !user) {
      me();
    }
    // Also handle hydration: zustand token is null but localStorage has tokens
    if (!token && !user && typeof window !== "undefined") {
      const lsToken = localStorage.getItem("accessToken");
      const lsRefresh = localStorage.getItem("refreshToken");
      if (lsToken || lsRefresh) {
        me();
      }
    }
  }, [token, user, me]);

  // Abort infinite spinner when session restore never completes
  useEffect(() => {
    const hasStoredTokens =
      typeof window !== "undefined" &&
      (Boolean(localStorage.getItem("accessToken")) ||
        Boolean(localStorage.getItem("refreshToken")));

    if ((token || hasStoredTokens) && !user && status === "loading") {
      setSessionWaitExpired(false);
      const timer = setTimeout(() => setSessionWaitExpired(true), SESSION_WAIT_MS);
      return () => clearTimeout(timer);
    }

    setSessionWaitExpired(false);
  }, [token, user, status]);

  useEffect(() => {
    if (sessionWaitExpired && !user) {
      logout();
      router.replace("/");
    }
  }, [sessionWaitExpired, user, logout, router]);

  useEffect(() => {
    // Still loading user data
    if (token && !user) {
      setStatus("loading");
      return;
    }

    // No zustand token yet — check localStorage before redirecting
    if (!token) {
      if (typeof window !== "undefined") {
        const lsToken = localStorage.getItem("accessToken");
        const lsRefresh = localStorage.getItem("refreshToken");
        if (lsToken || lsRefresh) {
          // Tokens exist in localStorage but zustand hasn't hydrated yet — wait
          setStatus("loading");
          return;
        }
      }
      router.replace("/");
      return;
    }

    const roles = normalizeRolesForUser(user);

    // A user with no recognized legacy roles but with permissions
    // is a valid custom-role user — don't redirect them to login
    const hasAnyPermissions = (user?.permissions?.length ?? 0) > 0;
    if (!roles.length && !hasAnyPermissions) {
      // No valid roles AND no permissions → redirect to login
      router.replace("/");
      return;
    }

    if (isRouteAllowedMulti(pathname, user)) {
      setStatus("allowed");
      setRedirecting(false);
    } else {
      setStatus("denied");
      // Auto-redirect after a brief moment so user sees the denied message
      const timer = setTimeout(() => {
        router.replace(getHomeRouteForUser(user));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname, user, userPermissionsKey, token, router, setRedirecting]);

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You don&apos;t have permission to view this page.
            <br />
            Redirecting you to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
