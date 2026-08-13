"use client";

import type { ComponentType } from "react";
import { Banknote, CreditCard, QrCode, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethodOption<T extends string = string> = {
  value: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color?: string;
};

export const STANDARD_PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash", label: "Cash", icon: Banknote, color: "text-emerald-600" },
  { value: "card", label: "Card", icon: CreditCard, color: "text-blue-600" },
  { value: "fonepay", label: "Fonepay", icon: QrCode, color: "text-fuchsia-600" },
  { value: "digital", label: "Digital/QR", icon: Smartphone, color: "text-purple-600" },
  { value: "credit", label: "Credit", icon: Wallet, color: "text-orange-600" },
];

type PaymentModeTabsProps = {
  multiple: boolean;
  onChange: (multiple: boolean) => void;
};

export function PaymentModeTabs({ multiple, onChange }: PaymentModeTabsProps) {
  return (
    <div className="flex gap-2 border-b pb-3">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 border-b-2 py-2 text-sm font-semibold transition-all",
          !multiple ? "border-primary text-primary" : "border-transparent text-muted-foreground",
        )}
      >
        Single Payment
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 border-b-2 py-2 text-sm font-semibold transition-all",
          multiple ? "border-primary text-primary" : "border-transparent text-muted-foreground",
        )}
      >
        Multiple Payments
      </button>
    </div>
  );
}

type PaymentMethodGridProps<T extends string> = {
  methods: PaymentMethodOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function PaymentMethodGrid<T extends string>({
  methods,
  value,
  onChange,
}: PaymentMethodGridProps<T>) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
      {methods.map((method) => (
        <button
          key={method.value}
          type="button"
          onClick={() => onChange(method.value)}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all",
            value === method.value
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <method.icon className={cn("h-4 w-4 shrink-0", method.color)} />
          <span className="truncate">{method.label}</span>
        </button>
      ))}
    </div>
  );
}
