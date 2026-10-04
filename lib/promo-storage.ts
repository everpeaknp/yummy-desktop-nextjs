// LocalStorage-based promo code storage
// Easy to switch to API calls later by replacing these functions

import { getOfferCode, isOfferCodeExpired } from "./promo-codes.config";

export interface ReferralPromoCode {
  id: string;
  code: string;
  restaurantId: string;
  restaurantName: string;
  usedCount: number;
  createdAt: string;
}

export interface PromoUsage {
  id: string;
  code: string;
  type: "referral" | "offer";
  usedByRestaurantId: string;
  usedByRestaurantName: string;
  generatedByRestaurantId?: string;
  generatedByRestaurantName?: string;
  benefit: string;
  usedAt: string;
}

export interface RestaurantSubscription {
  restaurantId: string;
  freeMonthsEarned: number;
  activeOffers: {
    code: string;
    benefit: string;
    appliedAt: string;
  }[];
}

const REFERRAL_PROMO_KEY = "yummy_referral_promo_codes";
const PROMO_USAGE_KEY = "yummy_promo_usage";
const SUBSCRIPTION_KEY = "yummy_restaurant_subscriptions";

function getStorageData<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to read from localStorage:", error);
    return [];
  }
}

function setStorageData<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to write to localStorage:", error);
  }
}

export function getReferralPromoForRestaurant(restaurantId: string): ReferralPromoCode | null {
  const allCodes = getStorageData<ReferralPromoCode>(REFERRAL_PROMO_KEY);
  return allCodes.find((code) => code.restaurantId === restaurantId) || null;
}

export function generateReferralPromoCode(restaurantId: string, restaurantName: string): ReferralPromoCode {
  // Check if restaurant already has a code
  const existing = getReferralPromoForRestaurant(restaurantId);
  if (existing) {
    return existing;
  }

  // Generate unique code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "YUM-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const newPromo: ReferralPromoCode = {
    id: `promo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    code,
    restaurantId,
    restaurantName,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  };

  const allCodes = getStorageData<ReferralPromoCode>(REFERRAL_PROMO_KEY);
  allCodes.push(newPromo);
  setStorageData(REFERRAL_PROMO_KEY, allCodes);

  return newPromo;
}

function getReferralPromoByCode(code: string): ReferralPromoCode | null {
  const allCodes = getStorageData<ReferralPromoCode>(REFERRAL_PROMO_KEY);
  return allCodes.find((p) => p.code.toLowerCase() === code.toLowerCase()) || null;
}

export function hasRestaurantUsedCode(restaurantId: string, code: string): boolean {
  const allUsages = getStorageData<PromoUsage>(PROMO_USAGE_KEY);
  return allUsages.some(
    (usage) => usage.usedByRestaurantId === restaurantId && usage.code.toLowerCase() === code.toLowerCase()
  );
}

export function applyPromoCode(
  code: string,
  usedByRestaurantId: string,
  usedByRestaurantName: string
): {
  success: boolean;
  type?: "referral" | "offer";
  reason?: string;
  benefit?: string;
  generatedByRestaurantName?: string;
} {
  // Check if restaurant has already used this code
  if (hasRestaurantUsedCode(usedByRestaurantId, code)) {
    return { success: false, reason: "You have already used this promo code." };
  }

  // First, check if it's a referral code
  const referralCode = getReferralPromoByCode(code);
  if (referralCode) {
    // Check if restaurant is trying to use their own code
    if (referralCode.restaurantId === usedByRestaurantId) {
      return { success: false, reason: "You cannot use your own promo code." };
    }

    // Record the usage
    const usage: PromoUsage = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      code: referralCode.code,
      type: "referral",
      usedByRestaurantId,
      usedByRestaurantName,
      generatedByRestaurantId: referralCode.restaurantId,
      generatedByRestaurantName: referralCode.restaurantName,
      benefit: "1 month free",
      usedAt: new Date().toISOString(),
    };

    const allUsages = getStorageData<PromoUsage>(PROMO_USAGE_KEY);
    allUsages.push(usage);
    setStorageData(PROMO_USAGE_KEY, allUsages);

    // Increment usage count
    const allCodes = getStorageData<ReferralPromoCode>(REFERRAL_PROMO_KEY);
    const codeIndex = allCodes.findIndex((c) => c.id === referralCode.id);
    if (codeIndex !== -1) {
      allCodes[codeIndex].usedCount += 1;
      setStorageData(REFERRAL_PROMO_KEY, allCodes);
    }

    // Grant 1 free month to both restaurants
    grantFreeMonth(usedByRestaurantId);
    grantFreeMonth(referralCode.restaurantId);

    return {
      success: true,
      type: "referral",
      benefit: "1 month free",
      generatedByRestaurantName: referralCode.restaurantName,
    };
  }

  // Check if it's an offer code
  const offerCode = getOfferCode(code);
  if (offerCode) {
    // Check if offer is expired
    if (isOfferCodeExpired(offerCode)) {
      return { success: false, reason: "This promo code has expired." };
    }

    // Record the usage
    const usage: PromoUsage = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      code: offerCode.code,
      type: "offer",
      usedByRestaurantId,
      usedByRestaurantName,
      benefit: offerCode.benefit,
      usedAt: new Date().toISOString(),
    };

    const allUsages = getStorageData<PromoUsage>(PROMO_USAGE_KEY);
    allUsages.push(usage);
    setStorageData(PROMO_USAGE_KEY, allUsages);

    // Apply offer to restaurant
    applyOffer(usedByRestaurantId, offerCode.code, offerCode.benefit);

    return {
      success: true,
      type: "offer",
      benefit: offerCode.benefit,
    };
  }

  // Code not found
  return { success: false, reason: "Invalid promo code. Please check and try again." };
}

function grantFreeMonth(restaurantId: string) {
  const allSubscriptions = getStorageData<RestaurantSubscription>(SUBSCRIPTION_KEY);
  const existingIndex = allSubscriptions.findIndex((s) => s.restaurantId === restaurantId);

  if (existingIndex !== -1) {
    allSubscriptions[existingIndex].freeMonthsEarned += 1;
  } else {
    allSubscriptions.push({
      restaurantId,
      freeMonthsEarned: 1,
      activeOffers: [],
    });
  }

  setStorageData(SUBSCRIPTION_KEY, allSubscriptions);
}

function applyOffer(restaurantId: string, code: string, benefit: string) {
  const allSubscriptions = getStorageData<RestaurantSubscription>(SUBSCRIPTION_KEY);
  const existingIndex = allSubscriptions.findIndex((s) => s.restaurantId === restaurantId);

  const offer = {
    code,
    benefit,
    appliedAt: new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    allSubscriptions[existingIndex].activeOffers.push(offer);
  } else {
    allSubscriptions.push({
      restaurantId,
      freeMonthsEarned: 0,
      activeOffers: [offer],
    });
  }

  setStorageData(SUBSCRIPTION_KEY, allSubscriptions);
}

export function getRestaurantSubscription(restaurantId: string): RestaurantSubscription {
  const allSubscriptions = getStorageData<RestaurantSubscription>(SUBSCRIPTION_KEY);
  const subscription = allSubscriptions.find((s) => s.restaurantId === restaurantId);
  return subscription || { restaurantId, freeMonthsEarned: 0, activeOffers: [] };
}

export function getPromoUsages(restaurantId: string): PromoUsage[] {
  const allUsages = getStorageData<PromoUsage>(PROMO_USAGE_KEY);
  return allUsages.filter(
    (usage) =>
      usage.usedByRestaurantId === restaurantId ||
      usage.generatedByRestaurantId === restaurantId
  );
}

export function getPeopleWhoJoinedWithMyCode(restaurantId: string): PromoUsage[] {
  const allUsages = getStorageData<PromoUsage>(PROMO_USAGE_KEY);
  // Filter for referral usages where I am the generator
  return allUsages
    .filter(
      (usage) =>
        usage.type === "referral" &&
        usage.generatedByRestaurantId === restaurantId
    )
    .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()); // Newest first
}
