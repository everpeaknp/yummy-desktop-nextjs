"use client";

import {
  BarChart3,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Send,
  ShoppingCart,
  Tag,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  GrowthCampaign,
  GrowthCampaignResultSummary,
} from "@/lib/api/growth-types";
import { cn } from "@/lib/utils";

function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-NP")
    : "0";
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Rs. 0";
  return `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 2 })}`;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

function MetricCard({ icon, label, value, detail, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-3 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-black/[0.08] dark:border-white/10 bg-muted">
            {icon}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-lg font-black tracking-tight tabular-nums mt-0.5">{value}</p>
          </div>
        </div>
        {trend && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 h-5",
              trend.positive 
                ? "border-green-500/20 bg-green-500/10 text-green-600" 
                : "border-amber-500/20 bg-amber-500/10 text-amber-600"
            )}
          >
            {trend.value}
          </Badge>
        )}
      </div>
      {detail && <p className="text-[10px] text-muted-foreground mt-1.5">{detail}</p>}
    </div>
  );
}

interface CampaignAnalyticsDashboardProps {
  campaign: GrowthCampaign;
  results: GrowthCampaignResultSummary;
  onDownloadCSV?: () => void;
  isDownloading?: boolean;
}

export function CampaignAnalyticsDashboard({ campaign, results, onDownloadCSV, isDownloading }: CampaignAnalyticsDashboardProps) {
  const sentCount = results.sent_count ?? 0;
  const deliveredCount = results.delivered_count ?? 0;
  const redeemedCount = results.redeemed_count ?? 0;
  const audienceCount = campaign.audience_count ?? 0;

  // Calculate rates
  const deliveryRate = sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0;
  const redemptionRate = deliveredCount > 0 ? (redeemedCount / deliveredCount) * 100 : 0;

  // Calculate revenue and ROI
  const totalRevenue = results.attributed_revenue ?? 0;
  const totalDiscounts = results.discount_cost ?? 0;
  const netRevenue = totalRevenue - totalDiscounts;

  return (
    <div className="space-y-6">
      {/* Campaign Performance Overview - Compact */}
      <Card className="dc-card">
        <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <BarChart3 className="h-3.5 w-3.5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Performance Analytics</CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground mt-0.5">
                  Delivery, engagement, and revenue metrics
                </CardDescription>
              </div>
            </div>
            {onDownloadCSV && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownloadCSV}
                disabled={isDownloading}
                className="dc-filter-refresh h-8 gap-2 rounded-xl px-3 text-xs"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Package className="h-3.5 w-3.5" />
                    Export CSV
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Users className="h-5 w-5 text-blue-600" />}
              label="Target Audience"
              value={formatCount(audienceCount)}
              detail="Customers eligible"
            />
            <MetricCard
              icon={<Send className="h-5 w-5 text-purple-600" />}
              label="Messages Sent"
              value={formatCount(sentCount)}
              detail={sentCount > 0 ? `${formatPercent(sentCount, audienceCount)} of audience` : "Not sent yet"}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              label="Delivered"
              value={formatCount(deliveredCount)}
              detail={sentCount > 0 ? `${deliveryRate.toFixed(1)}% delivery rate` : "Waiting for delivery"}
              trend={
                deliveryRate > 90
                  ? { value: "Excellent", positive: true }
                  : deliveryRate > 70
                  ? { value: "Good", positive: true }
                  : { value: "Needs attention", positive: false }
              }
            />
            <MetricCard
              icon={<ShoppingCart className="h-5 w-5 text-amber-600" />}
              label="Redeemed"
              value={formatCount(redeemedCount)}
              detail={deliveredCount > 0 ? `${redemptionRate.toFixed(1)}% redemption rate` : "No redemptions yet"}
              trend={
                redemptionRate > 5
                  ? { value: `${redemptionRate.toFixed(1)}%`, positive: true }
                  : { value: `${redemptionRate.toFixed(1)}%`, positive: false }
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Revenue & ROI - Compact */}
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={<Tag className="h-5 w-5 text-emerald-600" />}
          label="Total Revenue"
          value={formatMoney(totalRevenue)}
          detail={redeemedCount > 0 ? `From ${redeemedCount} redemptions` : "No redemptions yet"}
        />
        <MetricCard
          icon={<Package className="h-5 w-5 text-rose-600" />}
          label="Discounts Given"
          value={formatMoney(totalDiscounts)}
          detail={redeemedCount > 0 ? `Avg ${formatMoney(totalDiscounts / redeemedCount)} per use` : "No discounts given"}
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          label="Net Revenue"
          value={formatMoney(netRevenue)}
          detail={totalRevenue > 0 ? `${((netRevenue / totalRevenue) * 100).toFixed(1)}% after discounts` : "No revenue yet"}
          trend={
            netRevenue > 0
              ? { value: "Profitable", positive: true }
              : netRevenue < 0
              ? { value: "Loss", positive: false }
              : undefined
          }
        />
      </div>

      {/* Channel-specific metrics - Compact */}
      <Card className="dc-card">
        <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
              {campaign.channel === "email" ? (
                <Mail className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                {campaign.channel === "email" ? "Email" : "WhatsApp"} Stats
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground mt-0.5">
                Channel performance metrics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3 border border-black/[0.08] dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Delivery Rate</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 h-5",
                    deliveryRate > 90
                      ? "border-green-500/20 bg-green-500/10 text-green-600"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                  )}
                >
                  {deliveryRate.toFixed(1)}%
                </Badge>
              </div>
              <p className="text-lg font-bold">{formatCount(deliveredCount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                out of {formatCount(sentCount)} sent
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 border border-black/[0.08] dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Conversion Rate</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 h-5",
                    redemptionRate > 5
                      ? "border-green-500/20 bg-green-500/10 text-green-600"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                  )}
                >
                  {redemptionRate.toFixed(1)}%
                </Badge>
              </div>
              <p className="text-lg font-bold">{formatCount(redeemedCount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                from {formatCount(deliveredCount)} delivered
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
