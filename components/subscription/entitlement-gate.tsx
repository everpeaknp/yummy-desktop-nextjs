"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlement, useRequiredPlanName } from "@/hooks/use-subscription";
import { featurePresentation } from "@/lib/subscription/entitlements";
import { getHomeRouteForUser, isPathAccessible } from "@/lib/role-permissions";

export function EntitlementGate({
  entitlement,
  children,
  legacyFallback = false,
  description,
  lockedFallback,
}: {
  entitlement: string;
  children: React.ReactNode;
  legacyFallback?: boolean;
  title?: string;
  description?: string;
  lockedFallback?: React.ReactNode;
}) {
  const { allowed, loading, error, resolved } = useEntitlement(entitlement, legacyFallback);
  const requiredPlan = useRequiredPlanName(entitlement);
  const user = useAuth((state) => state.user);
  const canViewPlans = isPathAccessible("/premium", user);
  const feature = featurePresentation(entitlement);

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center" aria-label="Loading subscription access">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    );
  }

  if (error && !resolved) {
    return (
      <FeatureUnavailablePage
        eyebrow="ACCESS CHECK UNAVAILABLE"
        heading="We couldn’t confirm this feature’s access"
        featureName={feature.title}
        description="Your restaurant’s access could not be verified just now. Please try again shortly, or ask an administrator to check the plan settings."
        canViewPlans={canViewPlans}
        homeHref={getHomeRouteForUser(user)}
        hasError
      />
    );
  }

  if (allowed) return <>{children}</>;
  if (lockedFallback) return <>{lockedFallback}</>;

  return (
    <FeatureUnavailablePage
      eyebrow="PLAN ACCESS"
      heading="This feature isn’t on your current plan"
      featureName={feature.title}
      description={description || feature.description}
      requiredPlan={requiredPlan}
      canViewPlans={canViewPlans}
      homeHref={getHomeRouteForUser(user)}
    />
  );
}

function FeatureUnavailablePage({
  eyebrow,
  heading,
  featureName,
  description,
  requiredPlan,
  canViewPlans,
  homeHref,
  hasError = false,
}: {
  eyebrow: string;
  heading: string;
  featureName: string;
  description: string;
  requiredPlan?: string | null;
  canViewPlans: boolean;
  homeHref: string;
  hasError?: boolean;
}) {
  return (
    <main className="flex min-h-[58vh] w-full items-center justify-center px-4 py-10 sm:px-8 sm:py-14">
      <Card className="w-full max-w-3xl overflow-hidden rounded-3xl border-border bg-card shadow-sm">
        <CardContent className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.07] sm:h-28 sm:w-28">
              <div className="absolute inset-2 rounded-full border border-primary/10" />
              {hasError ? (
                <ShieldCheck className="relative h-10 w-10 text-primary sm:h-12 sm:w-12" strokeWidth={1.6} />
              ) : (
                <LockKeyhole className="relative h-10 w-10 text-primary sm:h-12 sm:w-12" strokeWidth={1.6} />
              )}
            </div>

            <span className="rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary">
              {eyebrow}
            </span>
            <p className="mt-5 text-sm font-semibold text-muted-foreground">{featureName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              {heading}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              {description}
            </p>

            {requiredPlan ? (
              <div className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                This feature is available on the <span className="font-semibold text-foreground">{requiredPlan}</span> plan.
              </div>
            ) : null}

            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              {canViewPlans ? (
                <Button asChild className="h-11 rounded-xl px-5">
                  <Link href="/premium">
                    View available plans <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <p className="flex min-h-11 items-center justify-center rounded-xl bg-muted/50 px-4 text-sm text-muted-foreground">
                  Ask your administrator to review access.
                </p>
              )}
              <Button asChild variant="outline" className="h-11 rounded-xl px-5">
                <Link href={homeHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to workspace
                </Link>
              </Button>
            </div>

            <p className="mt-8 text-xs leading-5 text-muted-foreground">
              Your current workspace and access remain unchanged while you continue with other available areas.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
