"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { getHomeRouteForUser } from "@/lib/role-permissions";
import { hasStoredSession } from "@/lib/auth-storage";

const PUBLIC_PATHS = new Set(["/", "/forgot-password"]);

/**
 * Restores session on cold start (browser + Electron) and redirects off the login
 * page when valid tokens exist. Electron always loads `/` on launch.
 */
export function SessionBootstrap() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const hydrated = useAuthHydrated();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const bootstrapSession = useAuth((s) => s.bootstrapSession);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    if (!hasStoredSession()) return;

    bootstrappedRef.current = true;
    void bootstrapSession();
  }, [hydrated, bootstrapSession]);

  useEffect(() => {
    if (!hydrated || !user || !token) return;
    if (!PUBLIC_PATHS.has(pathname)) return;

    router.replace(getHomeRouteForUser(user));
  }, [hydrated, user, token, pathname, router]);

  return null;
}
