"use client";

import { useState } from "react";
import { Copy, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  generateReferralPromoCode,
  getReferralPromoForRestaurant,
  applyPromoCode,
  type ReferralPromoCode,
} from "@/lib/promo-storage";

interface PromoCodeAreaProps {
  restaurantId: string;
  restaurantName: string;
  onPromoApplied: () => void;
}

export function PromoCodeArea({
  restaurantId,
  restaurantName,
  onPromoApplied,
}: PromoCodeAreaProps) {
  const [myPromoCode, setMyPromoCode] = useState<ReferralPromoCode | null>(
    () => getReferralPromoForRestaurant(restaurantId)
  );
  const [promoInput, setPromoInput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  const handleGenerate = () => {
    const code = generateReferralPromoCode(restaurantId, restaurantName);
    setMyPromoCode(code);
    toast({
      title: "Promo code generated!",
      description: `Your code ${code.code} is ready to share.`,
    });
  };

  const handleCopy = () => {
    if (!myPromoCode) return;
    navigator.clipboard.writeText(myPromoCode.code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Promo code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    setError("");
    setShowSuccess(false);

    if (!promoInput.trim()) {
      setError("Please enter a promo code");
      return;
    }

    const result = applyPromoCode(promoInput.trim(), restaurantId, restaurantName);

    if (!result.success) {
      setError(result.reason || "Invalid promo code");
      return;
    }

    // Success!
    setShowSuccess(true);
    setPromoInput("");
    setError("");
    toast({
      title: "🎉 Success!",
      description:
        result.type === "referral"
          ? `You and ${result.generatedByRestaurantName} both got 1 month free!`
          : `Offer unlocked! ${result.benefit} applied`,
    });
    onPromoApplied();
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 p-4">
      <div className="space-y-3">
        {/* Success Message */}
        {showSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/20 dark:bg-primary/30 px-3 py-2 text-sm text-primary dark:text-primary-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">Promo applied: 1 month free on paid plans.</span>
          </div>
        )}

        {/* Apply Promo Code */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Enter promo code"
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase());
                  setError("");
                }}
                className="h-10 rounded-lg border-primary/30 bg-white dark:bg-background"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleApply();
                  }
                }}
              />
              {error && (
                <p className="mt-1 text-xs text-destructive">{error}</p>
              )}
            </div>
            <Button
              onClick={handleApply}
              className="h-10"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>

        {/* Generate Code */}
        <div className="flex flex-col gap-2 border-t border-primary/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {!myPromoCode ? (
            <Button
              onClick={handleGenerate}
              variant="outline"
              className="h-10 border-primary/30 bg-white hover:bg-primary/10 dark:bg-background dark:hover:bg-primary/20"
            >
              Generate Promo Code
            </Button>
          ) : (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Your code:</span>
                <span className="font-mono text-base font-bold text-primary">
                  {myPromoCode.code}
                </span>
              </div>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="h-9 border-primary/30 bg-white hover:bg-primary/10 dark:bg-background dark:hover:bg-primary/20"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Helper Text */}
        <p className="text-xs text-primary dark:text-primary-foreground">
          Share this code. Whoever joins with it gets 1 month free, and so do you.
        </p>
      </div>
    </div>
  );
}
