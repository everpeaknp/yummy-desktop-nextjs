"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Loader2,
  LogOut,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useAuthHydrated } from "@/hooks/use-auth";
import {
  invitationTokenFromPayload,
  invitationTokenFromSearch,
  PENDING_INVITATION_TOKEN_KEY,
} from "@/lib/restaurant-invitation-link";

type InvitePageState = "opening" | "invalid" | "assigned";

/** Safe landing page for private, verified-email restaurant invitations. */
export default function InvitationLinkPage() {
  const hydrated = useAuthHydrated();
  const user = useAuth((state) => state.user);
  const [pageState, setPageState] =
    useState<InvitePageState>("opening");

  useEffect(() => {
    if (!hydrated) return;
    const incomingToken = invitationTokenFromSearch(window.location.search);
    const storedToken = invitationTokenFromPayload(
      localStorage.getItem(PENDING_INVITATION_TOKEN_KEY) || "",
    );
    const token = incomingToken || storedToken;

    // Do not retain the private token in browser history after capture.
    if (window.location.search) {
      window.history.replaceState(null, "", "/invite");
    }
    if (!token) {
      setPageState("invalid");
      return;
    }

    localStorage.setItem(PENDING_INVITATION_TOKEN_KEY, token);
    localStorage.removeItem("yummy:pending-join-code");

    if (user?.restaurant_id) {
      setPageState("assigned");
      return;
    }
    if (user) {
      window.location.replace("/onboarding?mode=join&invitation=1");
      return;
    }
    window.location.replace("/?invitation=1");
  }, [hydrated, user]);

  if (pageState === "assigned") {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-500/10 via-background to-orange-500/10 p-6">
        <div className="w-full max-w-lg rounded-3xl border bg-card p-7 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-700">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">
            You already belong to a restaurant
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Yummy supports one current restaurant at a time. This invitation
            is saved; leave your current restaurant before accepting it.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">
                Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/leave-restaurant">
                <LogOut className="mr-2 h-4 w-4" />
                Leave restaurant
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (pageState === "invalid") {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-500/10 via-background to-orange-500/10 p-6">
        <div className="w-full max-w-md rounded-3xl border bg-card p-7 text-center shadow-xl">
          <MailCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-5 text-2xl font-bold">
            This invitation link is incomplete
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the latest link from your invitation email or enter its
            fallback code after signing in.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Sign in to Yummy</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-500/10 via-background to-orange-500/10 p-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <MailCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Opening your invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the invited email to review it.
        </p>
        <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-primary" />
      </div>
    </main>
  );
}
