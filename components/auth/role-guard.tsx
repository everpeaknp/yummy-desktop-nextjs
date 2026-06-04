"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { hasStoredSession, readStoredTokens } from "@/lib/auth-storage";
import { isAuthRecoveryActive } from "@/lib/auth-recovery";
import {
  isSessionRestoreInFlight,
  hasSessionRestoreFinished,
} from "@/lib/session-restore";
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
  const meLoading = useAuth((state) => state.meLoading);
  const bootstrapSession = useAuth((state) => state.bootstrapSession);
  const logout = useAuth((state) => state.logout);
  const setRedirecting = useAuth((state) => state.setRedirecting);
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );
  const [sessionWaitExpired, setSessionWaitExpired] = useState(false);
  const hydrated = useAuthHydrated();

  const isDesktopShell =
    typeof window !== "undefined" &&
    !!(window as Window & { electronAPI?: { isDesktopShell?: boolean } })
      .electronAPI?.isDesktopShell;
  const SESSION_WAIT_MS = isDesktopShell ? 45000 : 20000;

  const restoringSession =
    isAuthRecoveryActive() ||
    isSessionRestoreInFlight() ||
    (hasStoredSession() && !hasSessionRestoreFinished()) ||
    meLoading;

  useEffect(() => {
    if (!hydrated || user || !hasStoredSession()) return;
    if (hasSessionRestoreFinished()) return;
    void bootstrapSession();
  }, [hydrated, user, bootstrapSession]);

  useEffect(() => {
    const hasStoredTokens = hasStoredSession();

    if (
      hydrated &&
      (token || hasStoredTokens) &&
      !user &&
      status === "loading" &&
      !restoringSession
    ) {
      setSessionWaitExpired(false);
      const timer = setTimeout(() => setSessionWaitExpired(true), SESSION_WAIT_MS);
      return () => clearTimeout(timer);
    }

    setSessionWaitExpired(false);
  }, [hydrated, token, user, status, restoringSession, SESSION_WAIT_MS]);

  useEffect(() => {
    if (sessionWaitExpired && !user && !restoringSession) {
      logout({ silent: true });
      router.replace("/");
    }
  }, [sessionWaitExpired, user, logout, router, restoringSession]);

  useEffect(() => {
    if (!hydrated) {
      setStatus("loading");
      return;
    }

    if (restoringSession) {
      setStatus("loading");
      return;
    }

    if ((token || hasStoredSession()) && !user) {
      setStatus("loading");
      return;
    }

    if (!token) {
      if (hasStoredSession()) {
        setStatus("loading");
        return;
      }
      router.replace("/");
      return;
    }

    const roles = normalizeRolesForUser(user);
    const hasAnyPermissions = (user?.permissions?.length ?? 0) > 0;
    if (!roles.length && !hasAnyPermissions) {
      router.replace("/");
      return;
    }

    if (isRouteAllowedMulti(pathname, user)) {
      setStatus("allowed");
      setRedirecting(false);
    } else {
      setStatus("denied");
      const timer = setTimeout(() => {
        router.replace(getHomeRouteForUser(user));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    pathname,
    user,
    userPermissionsKey,
    token,
    router,
    setRedirecting,
    hydrated,
    restoringSession,
  ]);

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
