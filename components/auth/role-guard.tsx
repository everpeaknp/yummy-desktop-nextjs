"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRoles,
  isRouteAllowedMulti,
  getHomeRouteForRoles,
} from "@/lib/role-permissions";
import { Loader2, ShieldAlert } from "lucide-react";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const token = useAuth((state) => state.token);
  const me = useAuth((state) => state.me);
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );

  // Restore session on mount if we have a token but no user
  useEffect(() => {
    if (token && !user) {
      me();
    }
  }, [token, user, me]);

  useEffect(() => {
    // Still loading user data
    if (token && !user) {
      setStatus("loading");
      return;
    }

    // No token at all → redirect to login
    if (!token) {
      router.replace("/");
      return;
    }

    const roles = normalizeRoles(
      user?.roles?.length ? user.roles : user?.role ? [user.role] : []
    );

    if (!roles.length) {
      // No valid roles → redirect to login
      router.replace("/");
      return;
    }

    if (isRouteAllowedMulti(pathname, roles)) {
      setStatus("allowed");
    } else {
      setStatus("denied");
      // Auto-redirect after a brief moment so user sees the denied message
      const timer = setTimeout(() => {
        router.replace(getHomeRouteForRoles(roles));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname, user, token, router, me]);

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
