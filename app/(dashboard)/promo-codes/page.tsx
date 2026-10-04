"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, CheckCircle2, Tag, Users, Award, Sparkles, Gift, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateReferralPromoCode,
  getReferralPromoForRestaurant,
  getRestaurantSubscription,
  getPeopleWhoJoinedWithMyCode,
  applyPromoCode,
  type ReferralPromoCode,
  type RestaurantSubscription,
  type PromoUsage,
} from "@/lib/promo-storage";
import { cn } from "@/lib/utils";

export default function PromoCodesPage() {
  const [myPromoCode, setMyPromoCode] = useState<ReferralPromoCode | null>(null);
  const [subscription, setSubscription] = useState<RestaurantSubscription | null>(null);
  const [joiners, setJoiners] = useState<PromoUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const restaurant = useRestaurant((state) => state.restaurant);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  const fetchData = useCallback(() => {
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      const code = getReferralPromoForRestaurant(restaurant.id.toString());
      setMyPromoCode(code);
      const sub = getRestaurantSubscription(restaurant.id.toString());
      setSubscription(sub);
      const peopleJoined = getPeopleWhoJoinedWithMyCode(restaurant.id.toString());
      setJoiners(peopleJoined);
    } catch (error) {
      console.error("Failed to fetch promo data:", error);
      toast({
        title: "Error",
        description: "Failed to load promo code data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, restaurant?.id]);

  useEffect(() => {
    if (restaurant?.id) fetchData();
  }, [fetchData, restaurant?.id]);

  const handleGenerateCode = () => {
    if (!restaurant?.id || !restaurant?.name) return;
    try {
      const code = generateReferralPromoCode(
        restaurant.id.toString(),
        restaurant.name
      );
      setMyPromoCode(code);
      fetchData(); // Refresh data
      toast({
        title: "Promo code generated!",
        description: `Your code ${code.code} is ready to share.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to generate promo code.",
        variant: "destructive",
      });
    }
  };

  const handleCopyCode = () => {
    if (!myPromoCode) return;
    navigator.clipboard.writeText(myPromoCode.code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Promo code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCode = async () => {
    if (!restaurant?.id || !restaurant?.name || !applyCode.trim()) return;
    
    setApplyLoading(true);
    setApplySuccess(null);
    setApplyError(null);
    
    try {
      const result = applyPromoCode(
        applyCode.trim(),
        restaurant.id.toString(),
        restaurant.name
      );
      
      if (result.success) {
        setApplySuccess(
          result.type === "referral"
            ? `You got 1 month free! ${result.generatedByRestaurantName || "Another restaurant"} also got 1 month free.`
            : result.benefit || "Promo applied successfully!"
        );
        setApplyCode("");
        fetchData(); // Refresh data
        toast({
          title: "Success!",
          description: result.benefit || "Promo code applied successfully.",
        });
      } else {
        setApplyError(result.reason || "Invalid promo code.");
        toast({
          title: "Error",
          description: result.reason || "Invalid promo code.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      setApplyError("Failed to apply promo code. Please try again.");
      toast({
        title: "Error",
        description: "Failed to apply promo code.",
        variant: "destructive",
      });
    } finally {
      setApplyLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Promo Codes</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Share your code. When another restaurant joins with it, you both get 1 month free.
        </p>
      </div>

      {/* Two cards side by side on desktop, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 1: My Promo Code */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">My Promo Code</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!myPromoCode ? (
              <div className="space-y-4 text-center py-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Gift className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">No promo code yet</p>
                  <p className="text-sm text-muted-foreground">
                    Generate your unique code to start earning rewards
                  </p>
                </div>
                <Button
                  onClick={handleGenerateCode}
                  size="lg"
                  className="mt-2 h-11 rounded-lg"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Promo Code
                </Button>
              </div>
            ) : (
              <>
                {/* Code Display */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Your Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3">
                      <p className="font-mono text-2xl font-bold tracking-wider text-primary md:text-3xl">
                        {myPromoCode.code}
                      </p>
                    </div>
                    <Button
                      onClick={handleCopyCode}
                      variant="outline"
                      size="lg"
                      className="h-[52px] shrink-0 rounded-lg border-primary/30 hover:bg-primary/10"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <span className="ml-2 hidden sm:inline">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-5 w-5" />
                          <span className="ml-2 hidden sm:inline">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Restaurants joined</p>
                        <p className="text-xl font-bold tabular-nums">{myPromoCode.usedCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Award className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Free months earned</p>
                        <p className="text-xl font-bold tabular-nums">{subscription?.freeMonthsEarned || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate New Code Button */}
                <Button
                  onClick={handleGenerateCode}
                  variant="outline"
                  className="w-full rounded-lg border-primary/30 hover:bg-primary/10"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate New Code
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Apply a Promo Code */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Apply a Promo Code</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Got a code from another restaurant or a special offer?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-3">
              <label htmlFor="promo-code-input" className="text-sm font-medium">
                Enter Code
              </label>
              <div className="flex gap-2">
                <Input
                  id="promo-code-input"
                  type="text"
                  placeholder="YUM-XXXX or OFFER20"
                  value={applyCode}
                  onChange={(e) => {
                    setApplyCode(e.target.value.toUpperCase());
                    setApplySuccess(null);
                    setApplyError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !applyLoading) {
                      handleApplyCode();
                    }
                  }}
                  className="h-11 flex-1 rounded-lg font-mono text-base uppercase"
                  disabled={applyLoading}
                />
                <Button
                  onClick={handleApplyCode}
                  disabled={!applyCode.trim() || applyLoading}
                  size="lg"
                  className="h-11 shrink-0 rounded-lg px-6"
                >
                  {applyLoading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Applying...
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            </div>

            {/* Success Message */}
            {applySuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    {applySuccess}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {applyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {applyError}
                  </p>
                </div>
              </div>
            )}

            {/* Info box */}
            {!applySuccess && !applyError && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="font-semibold text-foreground">Referral codes:</strong> Both you and the restaurant get 1 month free.
                  <br />
                  <strong className="font-semibold text-foreground">Offer codes:</strong> Special promotions with custom benefits.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* People Who Joined List */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">People Who Joined With My Code</CardTitle>
              {joiners.length > 0 && (
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                  {joiners.length}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {joiners.length === 0 ? (
            <div className="space-y-3 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No one has joined with your code yet</p>
                <p className="text-sm text-muted-foreground">
                  Share your promo code with other restaurants to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {joiners.map((joiner) => {
                const initial = joiner.usedByRestaurantName.charAt(0).toUpperCase();
                const dateJoined = new Date(joiner.usedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                
                return (
                  <div
                    key={joiner.id}
                    className="flex min-h-[72px] items-center gap-3 p-4 transition-colors hover:bg-muted/50 md:gap-4 md:p-5"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {initial}
                    </div>
                    
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{joiner.usedByRestaurantName}</p>
                      <p className="text-sm text-muted-foreground">Joined on {dateJoined}</p>
                    </div>
                    
                    {/* Badge */}
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                    >
                      1 month free given
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
