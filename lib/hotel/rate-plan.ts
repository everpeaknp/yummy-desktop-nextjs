import type { HotelEarlyDeparturePolicy } from "./types";

export const HOTEL_EARLY_DEPARTURE_POLICY_LABELS: Record<HotelEarlyDeparturePolicy, string> = {
  refund_unused: "Charge only the nights used",
  charge_one_night: "Charge one additional night",
  charge_percentage: "Charge a percentage of unused nights",
  charge_fixed: "Charge a fixed early-checkout fee",
  retain_full: "Charge the full booking",
};

export function hotelRateContractLabel(
  policy: HotelEarlyDeparturePolicy,
  value: string | number,
): string {
  const label = HOTEL_EARLY_DEPARTURE_POLICY_LABELS[policy];
  if (policy === "charge_percentage") return `${label} (${Number(value)}%)`;
  if (policy === "charge_fixed") return `${label} (${Number(value).toFixed(2)})`;
  return label;
}
