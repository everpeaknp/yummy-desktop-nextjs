"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Award, LockKeyhole, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEntitlement, useRequiredPlanName } from "@/hooks/use-subscription";
import { featurePresentation } from "@/lib/subscription/entitlements";

export function EntitlementGate({
  entitlement,
  children,
  legacyFallback = false,
  title,
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
  const feature = featurePresentation(entitlement);
  const [showUpgrade, setShowUpgrade] = useState(true);

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center" aria-label="Loading subscription access">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error && !resolved) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Unable to verify subscription access</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/premium">Open billing</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (allowed) return <>{children}</>;
  if (lockedFallback) return <>{lockedFallback}</>;

  const headline = "Premium feature";
  const body = description || `${feature.title} is not included in your current plan.`;

  return (
    <>
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent
          className="w-[calc(100%-2.5rem)] max-w-[36rem] rounded-[28px] border-0 bg-background p-0 shadow-2xl [&>button]:hidden sm:rounded-[30px]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="px-7 pb-8 pt-10 text-center sm:px-12 sm:pb-10 sm:pt-12">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-600 shadow-inner sm:h-32 sm:w-32">
              <Award className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={1.9} />
            </div>
            <h2 className="mt-8 text-[28px] font-bold tracking-[-0.035em] text-foreground sm:text-[32px]">{headline}</h2>
            <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-muted-foreground">{body}</p>
            {requiredPlan ? <p className="mt-3 text-sm font-medium text-muted-foreground">Available from the {requiredPlan} plan.</p> : null}
            <Button asChild className="mt-9 h-14 w-full rounded-2xl bg-gradient-to-r from-[#183b92] to-[#2563eb] text-xl font-semibold shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition-transform hover:scale-[1.01] hover:from-[#183b92] hover:to-[#2563eb]">
              <Link href="/premium"><Star className="mr-3 h-6 w-6 fill-current" />Upgrade now</Link>
            </Button>
            <button type="button" onClick={() => setShowUpgrade(false)} className="mt-6 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground">Maybe later</button>
          </div>
        </DialogContent>
      </Dialog>
      {!showUpgrade ? (
        <Card className="mx-auto mt-12 max-w-xl border-primary/20 bg-primary/[0.04]">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-primary" /><p className="text-sm font-medium">{feature.title} is locked on your current plan.</p></div>
            <Button asChild size="sm"><Link href="/premium">Upgrade now</Link></Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
