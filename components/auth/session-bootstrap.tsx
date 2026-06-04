"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { hasStoredSession, readStoredTokens } from "@/lib/auth-storage";
import { hasSessionRestoreFinished } from "@/lib/session-restore";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import { useRestaurant } from "@/hooks/use-restaurant";

const PUBLIC_PATHS = new Set(["/", "/forgot-password"]);

export function SessionBootstrap() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const hydrated = useAuthHydrated();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const bootstrapSession = useAuth((s) => s.bootstrapSession);
  const logout = useAuth((s) => s.logout);
  const fetchRestaurant = useRestaurant((s) => s.fetchRestaurant);
  const bootstrappedRef = useRef(false);
  const redirectedRef = useRef(false);
  const [restoreDone, setRestoreDone] = useState(false);

  const runBootstrap = useCallback(async () => {
    if (!hydrated || !hasStoredSession()) return;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    try {
      await bootstrapSession();
      const state = useAuth.getState();
      if (!state.user) {
        const stillHasTokens = readStoredTokens().accessToken || readStoredTokens().refreshToken;
        if (stillHasTokens) {
          logout({ silent: true });
        }
        return;
      }
      await fetchRestaurant(true);
    } finally {
      setRestoreDone(true);
    }
  }, [hydrated, bootstrapSession, logout, fetchRestaurant]);

  useEffect(() => {
    if (!hydrated) return;
    if (!hasStoredSession()) {
      setRestoreDone(true);
      return;
    }
    void runBootstrap();
  }, [hydrated, runBootstrap]);

  useEffect(() => {
    if (!hydrated || !restoreDone) return;
    if (!hasSessionRestoreFinished() && hasStoredSession()) return;
    if (!user || !token) return;
    if (!PUBLIC_PATHS.has(pathname)) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;
    router.replace(resolvePostLoginRoute(user));
  }, [hydrated, restoreDone, user, token, pathname, router]);

  return null;
}
