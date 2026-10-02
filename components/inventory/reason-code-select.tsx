"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Location transfers are intentionally omitted until inventory locations and
// paired transfer-out/transfer-in documents exist. A one-sided "transfer"
// would create or destroy company-wide inventory value.
const ADD_REASON_OPTIONS = [
  { value: "stock_count_correction", label: "Stock-count correction" },
  { value: "complimentary_stock", label: "Complimentary stock" },
] as const;

const REDUCE_REASON_OPTIONS = [
  { value: "waste", label: "Waste" },
  { value: "damage", label: "Damage" },
  { value: "expired_stock", label: "Expired stock" },
  { value: "stock_count_correction", label: "Stock-count correction" },
] as const;

export type AddStockReasonCode = (typeof ADD_REASON_OPTIONS)[number]["value"];
export type ReduceStockReasonCode = (typeof REDUCE_REASON_OPTIONS)[number]["value"];

export function ReasonCodeSelect({
  operation,
  value,
  onChange,
  disabled = false,
  label = "Reason",
}: {
  operation: "add" | "reduce";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const options = operation === "add" ? ADD_REASON_OPTIONS : REDUCE_REASON_OPTIONS;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select a reason" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
