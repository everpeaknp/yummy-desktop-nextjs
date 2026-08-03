export const ALL_FINANCE_STATIONS = "all" as const;

export type FinanceStationOption = {
  value: string;
  label: string;
};

type FinanceStationOptionsArgs = {
  includeAll?: boolean;
  hotelEnabled?: boolean;
  businessLine?: string | null;
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

export function financeStationOptions({
  includeAll = true,
  hotelEnabled = false,
  businessLine = "all",
}: FinanceStationOptionsArgs = {}): FinanceStationOption[] {
  const normalizedBusinessLine = String(businessLine ?? "all").toLowerCase();
  const scopedStations =
    normalizedBusinessLine === "hotel"
      ? [GENERAL_FINANCE_STATION, ...HOTEL_ONLY_FINANCE_STATIONS]
      : normalizedBusinessLine === "restaurant"
        ? [GENERAL_FINANCE_STATION, ...RESTAURANT_ONLY_FINANCE_STATIONS]
        : [
            GENERAL_FINANCE_STATION,
            ...RESTAURANT_ONLY_FINANCE_STATIONS,
            ...(hotelEnabled ? HOTEL_ONLY_FINANCE_STATIONS : []),
          ];

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

export function financeStationLabel(
  station: string | null | undefined,
): string {
  const normalized = toFinanceStationParam(station);
  if (!normalized) return "All Stations";

  return (
    financeStationOptions({ includeAll: false, hotelEnabled: true }).find(
      (option) => option.value === normalized,
    )?.label ??
    normalized
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
