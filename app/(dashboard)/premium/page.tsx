"use client";

import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Mail, 
  Phone, 
  Crown, 
  Star,
  ShieldCheck,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

export default function PremiumPage() {
  const { restaurant } = useRestaurant();

  const SUPPORT_EMAIL = "yummyever.np@gmail.com";
  const SUPPORT_PHONE = "9862936014";
  const WHATSAPP_NUMBER = "9862936014";
  const PREMIUM_PRICE = "Rs. 12,000 / year";
  const REGULAR_PRICE = "Rs. 19,999";

  const planState = restaurant?.plan_state?.toLowerCase() || "free";
  const effectivePlan = restaurant?.effective_plan?.toLowerCase() || "free";
  
  const isPaid = (effectivePlan === "paid" || effectivePlan === "trial_paid") && (planState === "paid" || planState === "trialing");
  const isTrialing = planState === "trialing";
  const isExpired = planState === "trial_expired" || planState === "paid_expired";

  const getTrialDaysRemaining = () => {
    if (!restaurant?.trial_ends_at) return 0;
    const days = differenceInDays(new Date(restaurant.trial_ends_at), new Date());
    return Math.max(0, days);
  };

  const getPlanTitle = () => {
    if (isTrialing) return "Premium Trial";
    if (isPaid && !isTrialing) return "Premium Plan";
    if (isExpired) return "Plan Expired";
    return "Free Plan";
  };

  const getPlanSubtitle = () => {
    if (isTrialing) {
      const days = getTrialDaysRemaining();
      const dateStr = restaurant?.trial_ends_at ? format(new Date(restaurant.trial_ends_at), "MMM do, yyyy") : "";
      return `Trial expires on ${dateStr} (${days} ${days === 1 ? 'day' : 'days'} left)`;
    }
    if (isPaid) return `Paid access active until ${restaurant?.paid_ends_at ? format(new Date(restaurant.paid_ends_at), "PPP") : "further notice"}.`;
    if (isExpired) return "Your access has been limited. Upgrade now to restore full functionality.";
    return "You are on free plan with usage and feature limits.";
  };

  const openWhatsApp = () => {
    const msg = `Hello Yummy Team, I want to upgrade my restaurant (${restaurant?.name || "Restaurant"}) to the Premium Plan (${PREMIUM_PRICE}).`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12">
      {/* Refined Hero */}
      <div className="space-y-4 text-center pb-8 border-b border-border/40">
        <div className="flex justify-center mb-4">
           {isPaid ? (
             <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
               <Crown className="h-8 w-8 text-amber-500" />
             </div>
           ) : (
             <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
               <Zap className="h-8 w-8 text-primary" />
             </div>
           )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {getPlanTitle()}
        </h1>
        <p className="text-muted-foreground font-medium text-sm max-w-lg mx-auto">
          {getPlanSubtitle()}
        </p>
      </div>

      {/* Pricing Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="group relative flex flex-col p-8 rounded-2xl border border-border bg-card hover:border-border/80 transition-all">
          <div className="mb-6">
            <h3 className="text-lg font-bold">Free Plan</h3>
            <p className="text-xs text-muted-foreground mt-1">Basic setup for daily operations</p>
          </div>
          
          <div className="flex-1 space-y-3.5 mb-8">
            <FeatureItem label="Up to 3 users & staff profiles" included />
            <FeatureItem label="Up to 100 menu items" included />
            <FeatureItem label="Up to 10 tables" included />
            <FeatureItem label="KOT & Billing included" included />
            <FeatureItem label="Standard support" included />
            <FeatureItem label="Advanced reporting" included={false} />
            <FeatureItem label="Custom receipt designer" included={false} />
          </div>

          <div className="mt-auto pt-6 border-t border-border/40">
             <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider h-11" disabled>
               Current Plan
             </Button>
          </div>
        </div>

        {/* Premium Plan */}
        <div className="relative flex flex-col p-8 rounded-2xl border-2 border-primary bg-primary/[0.01] shadow-xl shadow-primary/5 transition-all">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-full shadow-sm">
            Recommended
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-primary">Premium Plan</h3>
            <p className="text-xs text-muted-foreground mt-1">Everything included, no limits</p>
          </div>

          <div className="mb-8 p-5 rounded-xl bg-card border border-border/50">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground line-through">{REGULAR_PRICE}</span>
                <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20">SAVE 40%</span>
            </div>
            <div className="text-2xl font-black">{PREMIUM_PRICE}</div>
          </div>
          
          <div className="flex-1 space-y-3.5 mb-8">
            <FeatureItem label="Unlimited users & staff" included />
            <FeatureItem label="Unlimited menu & inventory" included />
            <FeatureItem label="Advanced finance & Period closure" included />
            <FeatureItem label="Full station designer access" included />
            <FeatureItem label="Custom receipt templates" included />
            <FeatureItem label="Daily automatic backups" included />
            <FeatureItem label="Priority support 24/7" included highlight />
          </div>

          <div className="mt-auto">
            <Button onClick={openWhatsApp} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-tight rounded-xl">
              <MessageSquare className="mr-2 h-4 w-4" />
              Upgrade Now
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle Support Footer */}
      <div className="pt-8 text-center sm:flex sm:items-center sm:justify-center sm:gap-6 text-xs text-muted-foreground font-medium">
        <p>Need a custom quote?</p>
        <div className="hidden sm:block h-1 w-1 rounded-full bg-border" />
        <a href={`tel:${SUPPORT_PHONE}`} className="hover:text-primary transition-colors font-bold">
          Call us: {SUPPORT_PHONE}
        </a>
        <div className="hidden sm:block h-1 w-1 rounded-full bg-border" />
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary transition-colors font-bold">
          Email: {SUPPORT_EMAIL}
        </a>
      </div>
    </div>
  );
}

function FeatureItem({ label, included, highlight }: { label: string; included: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded-full shrink-0",
        included ? (highlight ? "bg-primary/10" : "bg-emerald-500/10") : "bg-muted/50"
      )}>
        {included ? (
          <CheckCircle2 className={cn("h-3 w-3", highlight ? "text-primary" : "text-emerald-600")} />
        ) : (
          <XCircle className="h-3 w-3 text-muted-foreground/30" />
        )}
      </div>
      <span className={cn(
        "text-[13px] font-medium leading-none",
        !included && "text-muted-foreground/50",
        highlight && "text-primary font-semibold"
      )}>
        {label}
      </span>
    </div>
  );
}
