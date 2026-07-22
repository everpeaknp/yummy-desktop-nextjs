"use client";

import Link from "next/link";
import { AlertCircle, Crown, ShieldAlert, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParsedScopeError } from "@/lib/parse-api-scope-error";
import { isPlanScopeError } from "@/lib/parse-api-scope-error";

type HistoryScopeNoticeProps = {
  error: ParsedScopeError;
  onUseSuggestedRange?: () => void;
  suggestedRangeLabel?: string;
};

export function HistoryScopeNotice({
  error,
  onUseSuggestedRange,
  suggestedRangeLabel,
}: HistoryScopeNoticeProps) {
  if (isPlanScopeError(error)) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/20">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Upgrade for full history</h2>
              <p className="text-sm text-muted-foreground">{error.message}</p>
              <p className="text-xs text-muted-foreground">
                Review the published plan limits to find the history access your restaurant needs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onUseSuggestedRange ? (
              <Button variant="outline" onClick={onUseSuggestedRange}>
                {suggestedRangeLabel || "Use allowed range"}
              </Button>
            ) : null}
            <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/premium">
                <Zap className="w-4 h-4 mr-2" />
                View plans
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const Icon =
    error.kind === "role_manager_limit" || error.kind === "role_cashier_limit"
      ? ShieldAlert
      : AlertCircle;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Icon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-foreground">Date range restricted</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
        {onUseSuggestedRange ? (
          <Button variant="outline" size="sm" onClick={onUseSuggestedRange}>
            {suggestedRangeLabel || "Use allowed range"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
