export type CashDrawerBusinessLine = "restaurant" | "hotel";

type ResolveCashDrawerBusinessLineInput = {
  requested?: string | null;
  restaurantEnabled?: boolean | null;
  hotelEnabled?: boolean | null;
};

export function resolveCashDrawerBusinessLine({
  requested,
  restaurantEnabled,
  hotelEnabled,
}: ResolveCashDrawerBusinessLineInput): CashDrawerBusinessLine {
  const normalized = String(requested ?? "").trim().toLowerCase();
  if (normalized === "hotel" && hotelEnabled) return "hotel";
  if (normalized === "restaurant" && restaurantEnabled) return "restaurant";
  if (hotelEnabled && !restaurantEnabled) return "hotel";
  if (restaurantEnabled) return "restaurant";
  if (hotelEnabled) return "hotel";
  return "restaurant";
}

export function safeCashDrawerReturnPath(value?: string | null): string | null {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }
  return path;
}
