"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MonitorCog,
  MessageCircleMore,
  MessageCircleOff,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { growthApi } from "@/lib/api/growth";
import type { PublicGrowthPreferences } from "@/lib/api/growth-types";

function unavailableError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 400 || status === 404 || status === 410 || status === 422;
}

function safelyMaskedDestination(value?: string | null): string | null {
  if (!value) return null;
  if (value.includes("*")) return value;
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "••••";
  return `${compact.slice(0, 3)}••••${compact.slice(-2)}`;
}

export function PublicGrowthPreferencesClient({ signedToken }: { signedToken: string | null }) {
  const [preferences, setPreferences] = useState<PublicGrowthPreferences | null>(null);
  const [loading, setLoading] = useState(Boolean(signedToken));
  const [loadError, setLoadError] = useState<"unavailable" | "connection" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPreferences = async () => {
    if (!signedToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      setPreferences(await growthApi.getPublicPreferences(signedToken));
    } catch (error) {
      setPreferences(null);
      setLoadError(unavailableError(error) ? "unavailable" : "connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!signedToken) {
      setLoading(false);
      setLoadError("unavailable");
      return;
    }
    setLoading(true);
    setLoadError(null);
    growthApi
      .getPublicPreferences(signedToken)
      .then((result) => {
        if (active) setPreferences(result);
      })
      .catch((error) => {
        if (!active) return;
        setPreferences(null);
        setLoadError(unavailableError(error) ? "unavailable" : "connection");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signedToken]);

  const unsubscribe = async () => {
    if (!signedToken || !preferences || preferences.status === "opted_out") return;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await growthApi.unsubscribePublicPreferences(signedToken);
      if (result.unsubscribed) {
        setPreferences({
          ...preferences,
          status: result.status,
          revoked_at: result.revoked_at ?? preferences.revoked_at,
        });
      }
    } catch {
      setActionError("Your preference could not be updated. You remain subscribed for now; please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const maskedDestination = safelyMaskedDestination(preferences?.destination_masked);

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        {loading ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading your communication preference…</p>
          </div>
        ) : loadError ? (
          <Card className="w-full rounded-3xl shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-bold">This preference link is not available</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {loadError === "connection"
                  ? "The preference page could not be loaded. Check your connection and try again."
                  : "The link may be incomplete or expired. Ask the restaurant for a current preference link. No preference was changed."}
              </p>
              {loadError === "connection" && signedToken && (
                <Button className="mt-6" variant="outline" onClick={() => void loadPreferences()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              )}
            </CardContent>
          </Card>
        ) : preferences ? (
          <Card className="w-full overflow-hidden rounded-3xl shadow-xl">
            <div className="bg-gradient-to-r from-primary/15 to-emerald-500/15 p-7 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-background text-primary shadow-sm">
                {preferences.status === "opted_in" ? <MonitorCog className="h-8 w-8" /> : <MonitorCog className="h-8 w-8" />}
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Yummy Grow preferences</p>
              <h1 className="mt-2 text-2xl font-black">{preferences.restaurant_name}</h1>
            </div>
            <CardContent className="space-y-5 p-7 sm:p-8">
              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not update preference</AlertTitle>
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-2xl border bg-muted/25 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp marketing</p>
                    <p className="mt-1 font-semibold">{maskedDestination || "Saved WhatsApp contact"}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={preferences.status === "opted_in" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted text-muted-foreground"}
                  >
                    {preferences.status === "opted_in" ? "Offers on" : "Offers off"}
                  </Badge>
                </div>
              </div>

              {preferences.status === "opted_out" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                  <h2 className="mt-3 font-bold">WhatsApp offers are off</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">This restaurant should not include this contact in WhatsApp marketing campaigns.</p>
                </div>
              ) : (
                <div>
                  <h2 className="font-bold">Stop promotional WhatsApp messages?</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">This turns off marketing offers from this restaurant. It does not remove fiscal receipts, past orders, or legally required restaurant records.</p>
                  <Button type="button" variant="destructive" className="mt-4 w-full" disabled={submitting} onClick={() => void unsubscribe()}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircleOff className="mr-2 h-4 w-4" />}
                    Stop WhatsApp offers
                  </Button>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                This signed page only manages WhatsApp marketing consent for this restaurant. It does not expose your customer profile.
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
