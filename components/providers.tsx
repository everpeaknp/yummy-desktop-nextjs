"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionBootstrap } from "@/components/auth/session-bootstrap";
import { useAuth } from "@/hooks/use-auth";
import { MembershipEventsProvider } from "@/components/membership-events-provider";

function SessionExpiredListener() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    const onExpired = () => {
      logout({ silent: true });
      router.replace("/");
    };
    window.addEventListener("yummy-session-expired", onExpired);
    return () => window.removeEventListener("yummy-session-expired", onExpired);
  }, [logout, router]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SessionBootstrap />
      <SessionExpiredListener />
      <MembershipEventsProvider />
    </>
  );
}
