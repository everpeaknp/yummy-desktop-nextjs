"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DashboardStatusBannerProps = {
  error: string | null
  analyticsError: string | null
  refreshing?: boolean
  onRetry: () => void
}

export function DashboardStatusBanner({
  error,
  analyticsError,
  refreshing,
  onRetry,
}: DashboardStatusBannerProps) {
  if (!error && !analyticsError) return null

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        error
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            error ? "text-destructive" : "text-amber-600"
          )}
        />
        <div className="space-y-1">
          {error ? (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          ) : null}
          {analyticsError ? (
            <p className="text-sm text-foreground">
              <span className="font-semibold">Analytics:</span> {analyticsError}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-2"
        onClick={onRetry}
        disabled={refreshing}
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        Retry
      </Button>
    </div>
  )
}
