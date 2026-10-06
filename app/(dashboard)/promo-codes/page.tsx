"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, CheckCircle2, Tag, Users, Award, Sparkles, Gift, AlertCircle, Share2, Loader2, Info } from "lucide-react";
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
import { PromoCodeSkeleton } from "@/components/promo-codes/promo-code-skeleton";
import { HowItWorks } from "@/components/promo-codes/how-it-works";
import { ConfirmRegenerateDialog } from "@/components/promo-codes/confirm-regenerate-dialog";
import { ShareCodeDialog } from "@/components/promo-codes/share-code-dialog";
import { LivePromoSection } from "@/components/promo-codes/live-promo-section";

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
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  
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
    if (myPromoCode) {
      setShowRegenerateDialog(true);
      return;
    }
    generateNewCode();
  };

  const generateNewCode = () => {
    if (!restaurant?.id || !restaurant?.name) return;
    try {
      const code = generateReferralPromoCode(
        restaurant.id.toString(),
        restaurant.name
      );
      setMyPromoCode(code);
      fetchData();
      toast({
        title: "Success!",
        description: `Your code ${code.code} is ready to share.`,
      });
      setShowRegenerateDialog(false);
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
        applyCode.trim().toUpperCase(),
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
        fetchData();
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

  if (loading) {
    return <PromoCodeSkeleton />;
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

      {/* How It Works */}
      <HowItWorks />

      {/* Two cards side by side on desktop, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Card 1: My Promo Code */}
        <Card className="overflow-hidden flex flex-col lg:h-full">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Tag className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">My Promo Code</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Share this with other restaurants
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6 flex-1 flex flex-col">
            {!myPromoCode ? (
              <div className="space-y-5 text-center py-8 flex-1 flex flex-col justify-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Gift className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold">No promo code yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Generate your unique code to start earning rewards
                  </p>
                </div>
                <Button
                  onClick={handleGenerateCode}
                  size="lg"
                  className="mt-2 h-12 rounded-lg mx-auto"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Promo Code
                </Button>
              </div>
            ) : (
              <>
                {/* Code Display - Ticket Style */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Your Code</label>
                  <div className="relative rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                    <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background border-2 border-dashed border-primary/40" />
                    <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background border-2 border-dashed border-primary/40" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary md:text-4xl">
                          {myPromoCode.code}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCopyCode}
                          size="sm"
                          variant={copied ? "default" : "outline"}
                          className={cn(
                            "h-10 w-10 p-0 rounded-lg transition-all",
                            copied && "bg-primary text-primary-foreground"
                          )}
                        >
                          {copied ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Copy className="h-5 w-5" />
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowShareDialog(true)}
                          size="sm"
                          variant="outline"
                          className="h-10 w-10 p-0 rounded-lg"
                        >
                          <Share2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats - Better proportioned */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative space-y-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{myPromoCode.usedCount}</p>
                        <p className="text-xs text-muted-foreground">Restaurants joined</p>
                      </div>
                    </div>
                  </div>
                  <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative space-y-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{subscription?.freeMonthsEarned || 0}</p>
                        <p className="text-xs text-muted-foreground">Free months earned</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate New Code Button */}
                <Button
                  onClick={handleGenerateCode}
                  variant="outline"
                  className="w-full rounded-lg border-primary/30 hover:bg-primary/10 hover:border-primary transition-all"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate New Code
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Apply a Promo Code */}
        <Card className="overflow-hidden flex flex-col lg:h-full">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Gift className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Apply a Promo Code</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Got a code from another restaurant?
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6 flex-1 flex flex-col">
            <div className="space-y-3 flex-1">
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
                    setApplyCode(e.target.value.toUpperCase().trim());
                    setApplySuccess(null);
                    setApplyError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !applyLoading && applyCode.trim()) {
                      handleApplyCode();
                    }
                  }}
                  className="h-11 flex-1 rounded-lg font-mono text-base uppercase transition-all focus-visible:ring-2"
                  disabled={applyLoading}
                />
                <Button
                  onClick={handleApplyCode}
                  disabled={!applyCode.trim() || applyLoading}
                  size="lg"
                  className={cn(
                    "h-11 shrink-0 rounded-lg px-6 transition-all",
                    !applyCode.trim() && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {applyLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>

              {/* Success Message */}
              {applySuccess && (
                <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 animate-in fade-in slide-in-from-top-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">Success!</p>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-1">
                        {applySuccess}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {applyError && (
                <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 animate-in fade-in slide-in-from-top-2 dark:border-red-900 dark:bg-red-950/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100">Error</p>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                        {applyError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info box - Cleaner with icons */}
              {!applySuccess && !applyError && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">Referral codes</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Both you and the restaurant get 1 month free</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 flex-shrink-0 mt-0.5">
                      <Gift className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">Offer codes</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Special promotions with custom benefits</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Promo Codes Section */}
      <LivePromoSection />

      {/* People Who Joined List */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">People Who Joined With My Code</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Track everyone who used your promo code
                </CardDescription>
              </div>
            </div>
            {joiners.length > 0 && (
              <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary h-6 px-3">
                {joiners.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {joiners.length === 0 ? (
            <div className="space-y-4 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">No one has joined yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Share your promo code with other restaurants to start earning rewards
                </p>
              </div>
              {myPromoCode && (
                <Button
                  onClick={() => setShowShareDialog(true)}
                  variant="outline"
                  className="mt-2"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Your Code
                </Button>
              )}
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
                    className="flex min-h-[72px] items-center gap-4 p-5 transition-colors hover:bg-muted/30"
                  >
                    {/* Avatar */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {initial}
                    </div>
                    
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{joiner.usedByRestaurantName}</p>
                      <p className="text-sm text-muted-foreground">Joined on {dateJoined}</p>
                    </div>
                    
                    {/* Badge */}
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                    >
                      +1 month free
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {myPromoCode && (
        <>
          <ConfirmRegenerateDialog
            open={showRegenerateDialog}
            onOpenChange={setShowRegenerateDialog}
            onConfirm={generateNewCode}
            oldCode={myPromoCode.code}
          />
          <ShareCodeDialog
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
            code={myPromoCode.code}
            restaurantName={restaurant?.name || "us"}
          />
        </>
      )}
    </div>
  );
}
