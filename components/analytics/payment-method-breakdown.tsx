"use client";

import type { PaymentMixView } from "@/types/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

type PaymentMethodBreakdownProps = {
  title: string;
  description: string;
  mix: PaymentMixView | null | undefined;
};

export function PaymentMethodBreakdown({
  title,
  description,
  mix,
}: PaymentMethodBreakdownProps) {
  if (!mix?.available || mix.methods.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No payment breakdown for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-orange-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mix.methods.map((method) => (
          <div key={method.method} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold capitalize">{method.method}</span>
              <span className="text-sm font-bold">
                Rs. {method.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            {method.instruments.length > 0 ? (
              <ul className="ml-3 border-l border-border/60 pl-3 space-y-1.5">
                {method.instruments.map((inst) => (
                  <li
                    key={`${method.method}-${inst.name}`}
                    className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                  >
                    <span className="truncate">{inst.name}</span>
                    <span className="font-semibold text-foreground shrink-0">
                      Rs. {inst.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
