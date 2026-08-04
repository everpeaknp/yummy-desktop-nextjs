"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { growthApi } from "@/lib/api/growth";
import type {
  GrowthLanguage,
  PublicGrowthRestaurant,
} from "@/lib/api/growth-types";

function restaurantName(restaurant: PublicGrowthRestaurant): string {
  return restaurant.restaurant_name || "this restaurant";
}

function unavailableError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 410 || status === 423;
}

export function PublicGrowthSignup({ publicSlug }: { publicSlug: string | null }) {
  const [restaurant, setRestaurant] = useState<PublicGrowthRestaurant | null>(null);
  const [loading, setLoading] = useState(Boolean(publicSlug));
  const [loadError, setLoadError] = useState<"unavailable" | "connection" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<GrowthLanguage>("en");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [preferenceToken, setPreferenceToken] = useState<string | null>(null);

  const loadRestaurant = async () => {
    if (!publicSlug) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await growthApi.getPublicRestaurant(publicSlug);
      setRestaurant(result);
      const supported = result.approved_languages ?? [];
      if (supported.length > 0 && !supported.includes(language)) {
        setLanguage(supported[0]);
      }
    } catch (error) {
      setRestaurant(null);
      setLoadError(unavailableError(error) ? "unavailable" : "connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!publicSlug) {
      setLoading(false);
      setLoadError("unavailable");
      return;
    }
    setLoading(true);
    setLoadError(null);
    growthApi
      .getPublicRestaurant(publicSlug)
      .then((result) => {
        if (!active) return;
        setRestaurant(result);
        const supported = result.approved_languages ?? [];
        if (supported.length > 0) setLanguage(supported[0]);
      })
      .catch((error) => {
        if (!active) return;
        setRestaurant(null);
        setLoadError(unavailableError(error) ? "unavailable" : "connection");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicSlug]);

  const displayName = restaurant ? restaurantName(restaurant) : "Restaurant rewards";
  const consentText = useMemo(
    () =>
      restaurant?.consent_text ||
      `I agree to receive promotional offers from ${displayName} on WhatsApp. I can opt out at any time.`,
    [displayName, restaurant],
  );
  const supportedLanguages = restaurant?.approved_languages?.length
    ? restaurant.approved_languages
    : (["en", "ne", "ne_romanized"] as GrowthLanguage[]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restaurant || !publicSlug) return;
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError("Enter your name so the restaurant can recognize your membership.");
      return;
    }
    if ((phone.match(/\d/g) ?? []).length < 7) {
      setFormError("Enter a valid mobile number, including the country code when needed.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await growthApi.joinPublicRestaurant(publicSlug, {
        name: name.trim(),
        phone: phone.trim(),
        preferred_language: language,
        whatsapp_marketing_opt_in: whatsappConsent,
        policy_version: restaurant.consent_policy_version,
        consent_text_hash: restaurant.consent_text_hash,
      });
      setPreferenceToken(result.preference_token || null);
      setSubmitted(true);
    } catch {
      setFormError(
        "Your preference could not be saved right now. Nothing was changed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-500/10 via-background to-primary/10 p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        {loading ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Opening this restaurant&apos;s rewards page…</p>
          </div>
        ) : loadError ? (
          <Card className="w-full max-w-lg rounded-3xl shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-bold">This rewards page is not available</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {loadError === "connection"
                  ? "The page could not be loaded. Check your connection and try again."
                  : "Ask the restaurant for its latest Yummy Grow QR code. No customer information has been submitted."}
              </p>
              {loadError === "connection" && publicSlug && (
                <Button className="mt-6" variant="outline" onClick={() => void loadRestaurant()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              )}
            </CardContent>
          </Card>
        ) : submitted && restaurant ? (
          <Card className="w-full max-w-lg rounded-3xl shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-bold">Your preference has been saved</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Thanks for connecting with {displayName}. {whatsappConsent ? "You chose to receive relevant WhatsApp offers and can opt out at any time." : "You did not give WhatsApp marketing consent, so promotional WhatsApp messages remain off."}
              </p>
              {preferenceToken && (
                <Button asChild variant="outline" className="mt-6">
                  <Link href={`/grow/preferences?token=${encodeURIComponent(preferenceToken)}`}>
                    Review communication preference
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : restaurant ? (
          <Card className="w-full overflow-hidden rounded-3xl shadow-xl">
            <CardContent className="grid p-0 lg:grid-cols-[0.82fr_1.18fr]">
              <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-7 text-white sm:p-10">
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                    <Sprout className="h-7 w-7" />
                  </div>
                  <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">Powered by Yummy Grow</p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight">Stay connected with {displayName}</h1>
                  <p className="mt-4 text-sm leading-6 text-emerald-50/90">Join the restaurant&apos;s customer list and decide clearly whether you want relevant offers on WhatsApp.</p>
                  <div className="mt-8 space-y-3 text-sm text-emerald-50/90">
                    <p className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" />Offers can be selected for customer groups rather than sent as generic spam.</p>
                    <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Leaving the consent box unchecked means no WhatsApp marketing consent.</p>
                  </div>
                </div>
              </section>

              <form onSubmit={submit} className="space-y-5 p-7 sm:p-10" noValidate>
                <div>
                  <h2 className="text-2xl font-bold">Your details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Only share details you want this restaurant to keep for its customer program.</p>
                </div>

                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not save</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="growth-name">Name</Label>
                    <Input id="growth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="growth-phone">Mobile number</Label>
                    <Input id="growth-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+977 98XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} required />
                    <p className="text-xs text-muted-foreground">Use a number connected to WhatsApp if you choose to receive offers.</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Preferred language</Label>
                    <Select value={language} onValueChange={(value) => setLanguage(value as GrowthLanguage)}>
                      <SelectTrigger aria-label="Preferred language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {supportedLanguages.includes("en") && <SelectItem value="en">English</SelectItem>}
                        {supportedLanguages.includes("ne") && <SelectItem value="ne">नेपाली</SelectItem>}
                        {supportedLanguages.includes("ne_romanized") && <SelectItem value="ne_romanized">Romanized Nepali</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="growth-whatsapp-consent"
                      checked={whatsappConsent}
                      onCheckedChange={(checked) => setWhatsappConsent(checked === true)}
                      aria-describedby="growth-consent-help"
                    />
                    <div>
                      <Label htmlFor="growth-whatsapp-consent" className="cursor-pointer text-sm leading-5">{consentText}</Label>
                      <p id="growth-consent-help" className="mt-2 text-xs leading-5 text-muted-foreground">Optional and unchecked by default. Joining the customer program does not require WhatsApp marketing consent.</p>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircleMore className="mr-2 h-4 w-4" />}
                  Save my preference
                </Button>
                <p className="text-center text-[11px] leading-5 text-muted-foreground">Consent policy version {restaurant.consent_policy_version}. The restaurant controls its customer records; Yummy processes this choice for the restaurant.</p>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
