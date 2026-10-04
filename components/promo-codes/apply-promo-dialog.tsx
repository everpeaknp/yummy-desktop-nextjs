"use client";

import { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { applyPromoCode } from "@/lib/promo-storage";
import { cn } from "@/lib/utils";

interface ApplyPromoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  restaurantId: string;
  restaurantName: string;
}

export function ApplyPromoDialog({
  open,
  onOpenChange,
  onSuccess,
  restaurantId,
  restaurantName,
}: ApplyPromoDialogProps) {
  const [promoCode, setPromoCode] = useState("");
  const [appliedResult, setAppliedResult] = useState<{
    type: "referral" | "offer";
    benefit: string;
    generatedByRestaurantName?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setPromoCode("");
      setAppliedResult(null);
      setError("");
      setShowCelebration(false);
    }
  }, [open]);

  const handleApply = () => {
    setError("");
    setAppliedResult(null);
    setShowCelebration(false);

    if (!promoCode.trim()) {
      setError("Please enter a promo code");
      return;
    }

    const result = applyPromoCode(promoCode.trim(), restaurantId, restaurantName);

    if (!result.success) {
      setError(result.reason || "This promo code cannot be applied.");
      toast({
        title: "Cannot apply code",
        description: result.reason,
        variant: "destructive",
      });
      return;
    }

    // Success! Show celebration
    setAppliedResult({
      type: result.type!,
      benefit: result.benefit!,
      generatedByRestaurantName: result.generatedByRestaurantName,
    });
    setShowCelebration(true);

    const celebrationMessage =
      result.type === "referral"
        ? `You and ${result.generatedByRestaurantName} both got 1 month free!`
        : `Offer unlocked! ${result.benefit} applied`;

    toast({
      title: "🎉 Success!",
      description: celebrationMessage,
    });

    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Apply Promo Code
          </DialogTitle>
          <DialogDescription>
            Enter a referral code or festival offer code to get benefits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!appliedResult ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="promo-code-input">Promo Code</Label>
                <Input
                  id="promo-code-input"
                  placeholder="e.g., YUM-ABCD or DASHAIN20"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  className="h-11 rounded-xl uppercase"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleApply();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Referral codes give 1 month free to both restaurants. Offer codes apply automatic discounts.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button onClick={handleApply} className="w-full h-11 rounded-xl">
                Apply Code
              </Button>
            </>
          ) : (
            <div
              className={cn(
                "space-y-4 transition-all duration-500",
                showCelebration && "animate-in fade-in slide-in-from-bottom-4"
              )}
            >
              {/* Success Card */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-6">
                {/* Animated background sparkle */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
                
                <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg animate-in zoom-in duration-300">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {appliedResult.type === "referral" ? "1 Month Free! 🎉" : "Offer Unlocked! 🎉"}
                      </h3>
                      <p className="text-sm text-emerald-600 dark:text-emerald-500">
                        {appliedResult.type === "referral"
                          ? `You and ${appliedResult.generatedByRestaurantName}`
                          : "Your discount has been applied"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/60 dark:bg-black/20 p-4 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Code Applied</span>
                      <span className="font-mono font-bold text-foreground">{promoCode}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t pt-2">
                      <span className="text-sm text-muted-foreground">Benefit</span>
                      <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                        {appliedResult.benefit}
                      </span>
                    </div>
                  </div>

                  {appliedResult.type === "referral" && appliedResult.generatedByRestaurantName && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Both you and <strong>{appliedResult.generatedByRestaurantName}</strong> received 1 month free subscription!
                      </p>
                    </div>
                  )}

                  {appliedResult.type === "offer" && (
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 p-3 text-center">
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Your discount <strong>{appliedResult.benefit}</strong> is now active on your account
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAppliedResult(null);
                    setShowCelebration(false);
                    setPromoCode("");
                  }}
                  className="flex-1 h-11 rounded-xl"
                >
                  Apply Another
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-11 rounded-xl"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
