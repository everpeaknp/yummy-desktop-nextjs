export const ALL_FINANCE_STATIONS = "all" as const;

export type FinanceStationOption = {
  value: string;
  label: string;
};

export type CustomFinanceStation = {
  name: string;
  business_line?: string | null;
};

type FinanceStationOptionsArgs = {
  includeAll?: boolean;
  hotelEnabled?: boolean;
  businessLine?: string | null;
  /**
   * A restaurant's own dynamic Station rows (see components/stations/station-picker.tsx),
   * additive alongside the fixed 5. A station scoped to one business_line only
   * appears for that line; an unscoped one (business_line null) appears for both.
   */
  customStations?: CustomFinanceStation[];
};

const GENERAL_FINANCE_STATION: FinanceStationOption = {
  value: "general",
  label: "General / Shared",
};

const RESTAURANT_ONLY_FINANCE_STATIONS: FinanceStationOption[] = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bar", label: "Bar" },
  { value: "cafe", label: "Cafe" },
];

const HOTEL_ONLY_FINANCE_STATIONS: FinanceStationOption[] = [
  { value: "rooms", label: "Rooms / Hotel" },
];

// The category-station-foundation migration seeds a Station row named
// Kitchen/Bar/Cafe/Rooms/General for every restaurant, matching the fixed
// set by name -- those must never be re-listed as "custom" duplicates.
const FIXED_FINANCE_STATION_VALUES = new Set([
  GENERAL_FINANCE_STATION.value,
  ...RESTAURANT_ONLY_FINANCE_STATIONS.map((s) => s.value),
  ...HOTEL_ONLY_FINANCE_STATIONS.map((s) => s.value),
]);

function customStationOptionsForLine(
  customStations: CustomFinanceStation[],
  line: "hotel" | "restaurant",
): FinanceStationOption[] {
  return customStations
    .filter(
      (station) =>
        !station.business_line ||
        String(station.business_line).toLowerCase() === line,
    )
    .map((station) => ({
      value: station.name.trim().toLowerCase(),
      label: station.name.trim(),
    }))
    .filter(
      (option) =>
        option.value.length > 0 && !FIXED_FINANCE_STATION_VALUES.has(option.value),
    );
}

export function financeStationOptions({
  includeAll = true,
  hotelEnabled = false,
  businessLine = "all",
  customStations = [],
}: FinanceStationOptionsArgs = {}): FinanceStationOption[] {
  const normalizedBusinessLine = String(businessLine ?? "all").toLowerCase();

  let scopedStations: FinanceStationOption[];
  if (normalizedBusinessLine === "hotel") {
    scopedStations = [
      GENERAL_FINANCE_STATION,
      ...HOTEL_ONLY_FINANCE_STATIONS,
      ...customStationOptionsForLine(customStations, "hotel"),
    ];
  } else if (normalizedBusinessLine === "restaurant") {
    scopedStations = [
      GENERAL_FINANCE_STATION,
      ...RESTAURANT_ONLY_FINANCE_STATIONS,
      ...customStationOptionsForLine(customStations, "restaurant"),
    ];
  } else {
    const combinedCustom = new Map<string, FinanceStationOption>();
    for (const option of customStationOptionsForLine(customStations, "restaurant")) {
      combinedCustom.set(option.value, option);
    }
    if (hotelEnabled) {
      for (const option of customStationOptionsForLine(customStations, "hotel")) {
        combinedCustom.set(option.value, option);
      }
    }
    scopedStations = [
      GENERAL_FINANCE_STATION,
      ...RESTAURANT_ONLY_FINANCE_STATIONS,
      ...(hotelEnabled ? HOTEL_ONLY_FINANCE_STATIONS : []),
      ...Array.from(combinedCustom.values()),
    ];
  }

  return includeAll
    ? [
        { value: ALL_FINANCE_STATIONS, label: "All Stations" },
        ...scopedStations,
      ]
    : scopedStations;
}

export function toFinanceStationParam(
  station: string | null | undefined,
  scope?: Omit<FinanceStationOptionsArgs, "includeAll">,
): string | undefined {
  const raw = String(station ?? "")
    .trim()
    .toLowerCase();
  if (!raw || raw === ALL_FINANCE_STATIONS) return undefined;
  const normalized = raw === "other" ? "general" : raw;
  if (
    scope &&
    !financeStationOptions({ ...scope, includeAll: false }).some(
      (option) => option.value === normalized,
    )
  ) {
    return undefined;
  }
  return normalized;
}

export function isFinanceStationAvailable(
  station: string | null | undefined,
  scope: Omit<FinanceStationOptionsArgs, "includeAll">,
): boolean {
  const raw = String(station ?? "")
    .trim()
    .toLowerCase();
  if (!raw || raw === ALL_FINANCE_STATIONS) return true;
  return toFinanceStationParam(raw, scope) != null;
}

/**
 * Canonical station for a finance record being created or edited.
 * Reporting may omit a station to mean "All"; stored finance activity may not.
 */
export function toFinanceAttributionStation(
  station: string | null | undefined,
): string {
  const normalized = String(station ?? "")
    .trim()
    .toLowerCase();
  return !normalized ||
    normalized === ALL_FINANCE_STATIONS ||
    normalized === "other"
    ? "general"
    : normalized;
}

/**
 * Derives the fixed-vocabulary legacy attribution (general/kitchen/bar/cafe
 * or general/rooms) from a real dynamic Station's name, for local
 * expense-category-type filtering only -- mirrors
 * ExpenseService._legacy_station_for_reference on the backend exactly. A
 * custom station name (e.g. "Poolside") that isn't one of the fixed names
 * falls back to `fallback` (if itself valid) or "general". The dynamic
 * station_id remains the real, specific attribution sent to the backend;
 * this bucket only decides which expense categories to show.
 */
export function legacyStationBucketForStationName(
  stationName: string | null | undefined,
  businessLine: "hotel" | "restaurant",
  fallback?: string | null,
): string {
  const allowed = new Set(
    (businessLine === "hotel"
      ? [GENERAL_FINANCE_STATION, ...HOTEL_ONLY_FINANCE_STATIONS]
      : [GENERAL_FINANCE_STATION, ...RESTAURANT_ONLY_FINANCE_STATIONS]
    ).map((option) => option.value),
  );
  const normalized = String(stationName ?? "").trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  const fallbackNormalized = String(fallback ?? "").trim().toLowerCase();
  return allowed.has(fallbackNormalized) ? fallbackNormalized : "general";
}

export function financeStationLabel(
  station: string | null | undefined,
  customStations: CustomFinanceStation[] = [],
): string {
  const normalized = toFinanceStationParam(station);
  if (!normalized) return "All Stations";

  return (
    financeStationOptions({
      includeAll: false,
      hotelEnabled: true,
      customStations,
    }).find((option) => option.value === normalized)?.label ??
    normalized
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
