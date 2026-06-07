"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { MergedInsight } from "@/lib/dashboard-utils"
import {
  ArrowRight,
  CheckCircle,
  Lightbulb,
  TrendingDown,
} from "lucide-react"

type UnifiedInsightsCardProps = {
  insights: MergedInsight[]
  loading?: boolean
  unavailable?: boolean
}

function insightTone(insight: MergedInsight) {
  const level = String(insight.level || insight.type || "").toUpperCase()
  if (level === "WARNING" || level === "HIGH") {
    return {
      border: "border-amber-500/40 bg-amber-500/5",
      icon: TrendingDown,
      iconClass: "text-amber-600",
    }
  }
  if (level === "POSITIVE") {
    return {
      border: "border-emerald-500/30 bg-emerald-500/5",
      icon: CheckCircle,
      iconClass: "text-emerald-600",
    }
  }
  return {
    border: "border-primary/20 bg-primary/5",
    icon: Lightbulb,
    iconClass: "text-primary",
  }
}

export function UnifiedInsightsCard({
  insights,
  loading,
  unavailable,
}: UnifiedInsightsCardProps) {
  const visible = insights.slice(0, 3)

  return (
    <Card className="dc-card h-full transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="border-b border-black/[0.08] pb-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="dc-card-title flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Insights
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="dc-filter-refresh h-8 gap-1 rounded-xl px-2 text-xs">
            <Link href="/analytics">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            Analytics access is required to load AI recommendations.
          </p>
        ) : loading && visible.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length > 0 ? (
          <>
            {visible.map((insight, index) => {
              const tone = insightTone(insight)
              const Icon = tone.icon
              const content = (
                <div
                  className={cn(
                    "rounded-xl border border-black/[0.08] p-3 transition-colors dark:border-white/15",
                    tone.border,
                    insight.route && "hover:shadow-sm"
                  )}
                >
                  <div className="flex gap-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.iconClass)} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold leading-snug text-foreground">
                        <span>{insight.message}</span>
                        <span className="font-semibold text-muted-foreground">
                          {" "}
                          — {insight.source === "ai" ? "AI" : "Operational"}
                        </span>
                      </p>
                      {insight.suggested_action ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {insight.suggested_action}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )

              if (insight.route) {
                return (
                  <Link key={`${insight.message}-${index}`} href={insight.route}>
                    {content}
                  </Link>
                )
              }

              return <div key={`${insight.message}-${index}`}>{content}</div>
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="mb-3 h-8 w-8 text-emerald-500" />
            <p className="dc-card-title text-sm">No notable issues</p>
            <p className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">
              Operations look stable for the selected period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
