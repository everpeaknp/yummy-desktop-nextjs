export const ONBOARDING_PENDING_TOUR_KEY = "yummy:onboarding:pending-tour";
export const ONBOARDING_HOURS_KEY = "yummy:onboarding:hours";

type OnboardingUser = {
  role?: string | null;
  roles?: string[] | null;
  primary_role?: string | null;
  restaurant_id?: number | null;
} | null;

function collectRoles(user: OnboardingUser): string[] {
  if (!user) return [];
  return [
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role,
    user.primary_role,
  ]
    .filter(Boolean)
    .map((r) => String(r).toLowerCase());
}

/** First-time restaurant create (admin dashboard roles). */
export function canAccessOnboarding(user: OnboardingUser): boolean {
  if (!user) return false;
  return collectRoles(user).some((r) => r === "admin" || r === "owner" || r === "manager");
}

/** Replay from Help is admin-only after the restaurant already exists. */
export function canReplayOnboarding(user: OnboardingUser): boolean {
  if (!user) return false;
  return collectRoles(user).some((r) => r === "admin");
}

/** True when the user still needs first registration (no restaurant yet). */
export function needsFirstOnboarding(user: OnboardingUser): boolean {
  if (!user) return false;
  return !user.restaurant_id;
}

export type BusinessType = "dine_in" | "cafe" | "cloud_kitchen";

export type WorkspaceMode = "restaurant" | "hotel" | "both";

export type PaymentMethodKey = "cash" | "card" | "digital_wallet";

export type DayHours = {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
};

export type OnboardingDraft = {
  restaurantName: string;
  phone: string;
  email: string;
  taxNumber: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  businessDayStartTime: string;
  profilePicture: string;
  coverPhoto: string;
  workspace: WorkspaceMode;
  businessType: BusinessType;
  hours: DayHours[];
  tables: number;
  currency: string;
  taxRate: number;
  taxEnabled: boolean;
  kotEnabled: boolean;
  receiptShowLogo: boolean;
  receiptShowPan: boolean;
  receiptFooter: string;
  orderStart: number;
  payments: PaymentMethodKey[];
  timezone: string;
};

export const ONBOARDING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WORKSPACE_OPTIONS: Array<{
  value: WorkspaceMode;
  title: string;
  description: string;
}> = [
  {
    value: "restaurant",
    title: "Restaurant POS",
    description: "Orders, KOT, tables, menu, and restaurant analytics.",
  },
  {
    value: "hotel",
    title: "Hotel Management",
    description: "Room folios, check-ins, housekeeping, and hotel analytics.",
  },
  {
    value: "both",
    title: "Restaurant + Hotel",
    description: "Run both workspaces and choose from the gateway after setup.",
  },
];

export const BUSINESS_TYPE_OPTIONS: Array<{
  value: BusinessType;
  title: string;
  description: string;
}> = [
  {
    value: "dine_in",
    title: "Dine-in restaurant",
    description: "Tables, waiters, kitchen tickets and billing.",
  },
  {
    value: "cafe",
    title: "Cafe or bakery",
    description: "Fast checkout, counters and takeaway orders.",
  },
  {
    value: "cloud_kitchen",
    title: "Cloud kitchen",
    description: "Delivery-first workflow with no dining tables.",
  },
];

export const PAYMENT_OPTIONS: Array<{
  value: PaymentMethodKey;
  title: string;
}> = [
  { value: "cash", title: "Cash" },
  { value: "card", title: "Card" },
  { value: "digital_wallet", title: "Digital wallet" },
];

export function defaultHours(): DayHours[] {
  return ONBOARDING_DAYS.map((day, index) => ({
    day,
    open: index === 6 ? "10:00" : "09:00",
    close: index === 6 ? "22:00" : "23:00",
    isOpen: true,
  }));
}

export function createEmptyDraft(email = ""): OnboardingDraft {
  return {
    restaurantName: "",
    phone: "",
    email,
    taxNumber: "",
    address: "",
    description: "",
    latitude: "",
    longitude: "",
    businessDayStartTime: "00:00",
    profilePicture: "",
    coverPhoto: "",
    workspace: "both",
    businessType: "dine_in",
    hours: defaultHours(),
    tables: 12,
    currency: "NPR",
    taxRate: 13,
    taxEnabled: true,
    kotEnabled: true,
    receiptShowLogo: true,
    receiptShowPan: true,
    receiptFooter: "Thank you for dining with us.",
    orderStart: 1001,
    payments: ["cash", "card", "digital_wallet"],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kathmandu",
  };
}

export function businessTypeLabel(value: BusinessType) {
  return BUSINESS_TYPE_OPTIONS.find((o) => o.value === value)?.title ?? value;
}

export function workspaceLabel(value: WorkspaceMode) {
  return WORKSPACE_OPTIONS.find((o) => o.value === value)?.title ?? value;
}

export function workspaceFlags(workspace: WorkspaceMode) {
  return {
    restaurant_enabled: workspace === "restaurant" || workspace === "both",
    hotel_enabled: workspace === "hotel" || workspace === "both",
  };
}

export function earliestOpenTime(hours: DayHours[]) {
  const openDays = hours.filter((h) => h.isOpen && h.open);
  if (!openDays.length) return "09:00:00";
  const sorted = [...openDays].sort((a, b) => a.open.localeCompare(b.open));
  const [hh, mm] = sorted[0].open.split(":");
  return `${hh.padStart(2, "0")}:${(mm || "00").padStart(2, "0")}:00`;
}

export function markPendingTour() {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_PENDING_TOUR_KEY, "1");
}

export function consumePendingTour() {
  if (typeof window === "undefined") return false;
  const pending = localStorage.getItem(ONBOARDING_PENDING_TOUR_KEY) === "1";
  if (pending) localStorage.removeItem(ONBOARDING_PENDING_TOUR_KEY);
  return pending;
}

export function saveOnboardingHours(hours: DayHours[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_HOURS_KEY, JSON.stringify(hours));
}

export function paymentCardsFromSelection(payments: PaymentMethodKey[]) {
  return payments
    .filter((p) => p !== "cash")
    .map((p) => ({
      name: p === "card" ? "Card" : "Digital Wallet",
      identifier: p === "card" ? "CARD" : "WALLET",
    }));
}
