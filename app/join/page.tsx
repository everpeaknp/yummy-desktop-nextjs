"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Loader2, LogOut, QrCode } from "lucide-react";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const pendingCodeKey = "yummy:pending-join-code";

/** HTTPS fallback for app/universal links printed in restaurant join QRs. */
export default function JoinLinkPage() {
  const hydrated = useAuthHydrated();
  const user = useAuth((state) => state.user);
  const [hasCurrentMembership, setHasCurrentMembership] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const code = new URLSearchParams(window.location.search).get("code")?.trim();
    if (!code) {
      window.location.replace(user ? "/onboarding" : "/");
      return;
    }
    localStorage.setItem(pendingCodeKey, code);
    if (user?.restaurant_id) {
      setHasCurrentMembership(true);
      return;
    }
    if (user) {
      window.location.replace(`/onboarding?mode=join&code=${encodeURIComponent(code)}`);
    } else {
      window.location.replace(`/?join_code=${encodeURIComponent(code)}`);
    }
  }, [hydrated, user]);

  if (hasCurrentMembership) {
    return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-primary/10 via-background to-blue-500/10 p-6"><div className="w-full max-w-lg rounded-3xl border bg-card p-7 text-center shadow-xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-700"><Building2 className="h-8 w-8" /></div><h1 className="mt-5 text-2xl font-bold">You already belong to a restaurant</h1><p className="mt-2 text-sm text-muted-foreground">Yummy supports one current restaurant at a time. Your scanned code is saved; leave your current restaurant first, then it will open automatically in onboarding.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button asChild variant="outline"><Link href="/dashboard">Dashboard<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild><Link href="/leave-restaurant"><LogOut className="mr-2 h-4 w-4" />Leave current restaurant</Link></Button></div></div></main>;
  }

  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-primary/10 via-background to-blue-500/10 p-6"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><QrCode className="h-8 w-8" /></div><h1 className="mt-5 text-2xl font-bold">Opening your restaurant invitation</h1><p className="mt-2 text-sm text-muted-foreground">Sign in if needed. Your join code will be waiting.</p><Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-primary" /></div></main>;
}
