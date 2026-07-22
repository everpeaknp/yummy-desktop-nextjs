"use client";

import Link from "next/link";
import { AlertCircle, LockKeyhole, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement, useRequiredPlanName } from "@/hooks/use-subscription";

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

  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
            <LockKeyhole className="h-6 w-6 text-amber-600" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{title || "This feature is not included in your plan"}</h2>
            <p className="text-sm text-muted-foreground">
              {description ||
                (requiredPlan
                  ? `${requiredPlan} is the first published plan that includes this feature.`
                  : "Review the available plans or contact Yummy for access.")}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/premium">View plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
