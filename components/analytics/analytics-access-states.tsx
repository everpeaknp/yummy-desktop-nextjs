"use client";

import Link from "next/link";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AnalyticsAccessLoading() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
    </div>
  );
}

export function AnalyticsAccessDenied() {
  return (
    <div className="max-w-lg mx-auto p-6">
      <Card className="border-destructive/30">
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Analytics access required</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You need the reports.analytics.view permission to open this page.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type AnalyticsFetchErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function AnalyticsFetchError({ message, onRetry }: AnalyticsFetchErrorProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">Failed to load analytics data</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
