/**
 * Live Promo Code Service (LocalStorage Implementation)
 * 
 * WARNING: This is a LocalStorage-only implementation for Phase 1.
 * For production, replace this entire file with API calls to a backend service.
 * The async/Promise pattern is used to make the transition seamless.
 */

import { OFFER_CODES } from "./promo-codes.config";
import type {
  LivePromoCode,
  CreateLivePromoInput,
  UpdateLivePromoInput,
  LivePromoStatus,
} from "./live-promo-types";

const LIVE_PROMO_KEY = "yummy_live_promo_codes";
const SEEDED_FLAG_KEY = "yummy_live_promo_seeded";

// Helper: Get all promo codes from localStorage
function getStorageData(): LivePromoCode[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LIVE_PROMO_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to read live promo codes from localStorage:", error);
    return [];
  }
}

// Helper: Save all promo codes to localStorage
function setStorageData(data: LivePromoCode[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIVE_PROMO_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to write live promo codes to localStorage:", error);
  }
}

// Helper: Check if already seeded
function isSeeded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SEEDED_FLAG_KEY) === "true";
}

// Helper: Mark as seeded
function markSeeded(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEDED_FLAG_KEY, "true");
}

// Helper: Seed from OFFER_CODES config on first load
function seedFromConfig(): void {
  if (isSeeded()) return;
  
  const existing = getStorageData();
  if (existing.length > 0) {
    markSeeded();
    return;
  }

  const now = new Date().toISOString();
  const seededCodes: LivePromoCode[] = OFFER_CODES.map((offer, index) => ({
    id: `seeded_${Date.now()}_${index}`,
    code: offer.code,
    type: "offer",
    benefit: offer.benefit,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    description: offer.description,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    endDate: offer.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now if no expiry
    usageLimit: 1000,
    currentUsage: 0,
    isActive: offer.isActive,
    createdAt: now,
    updatedAt: now,
  }));

  setStorageData(seededCodes);
  markSeeded();
}

// Helper: Compute status from dates and toggle
export function computePromoStatus(promo: LivePromoCode): LivePromoStatus {
  if (!promo.isActive) return "disabled";
  
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);

  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

// Helper: Validate promo code input
function validatePromoInput(
  input: CreateLivePromoInput | UpdateLivePromoInput,
  existingCodes: LivePromoCode[],
  currentId?: string
): { valid: boolean; error?: string } {
  // Check code uniqueness (case-insensitive)
  const codeExists = existingCodes.some(
    (p) => p.code.toLowerCase() === input.code?.toLowerCase() && p.id !== currentId
  );
  if (codeExists) {
    return { valid: false, error: "This code already exists. Please use a unique code." };
  }

  // Validate code format (alphanumeric, dashes, underscores)
  if (input.code && !/^[A-Z0-9-_]+$/i.test(input.code)) {
    return { valid: false, error: "Code can only contain letters, numbers, dashes, and underscores." };
  }

  // Validate discount value
  if (input.discountType === "percentage") {
    if (input.discountValue < 1 || input.discountValue > 100) {
      return { valid: false, error: "Percentage discount must be between 1 and 100." };
    }
  } else if (input.discountType === "fixed") {
    if (input.discountValue <= 0) {
      return { valid: false, error: "Fixed discount must be greater than 0." };
    }
  }

  // Validate dates
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (end <= start) {
      return { valid: false, error: "End date must be after start date." };
    }
  }

  // Validate usage limit
  if (input.usageLimit !== undefined && input.usageLimit < 1) {
    return { valid: false, error: "Usage limit must be at least 1." };
  }

  return { valid: true };
}

// Public API: List all live promo codes
export async function listLivePromoCodes(): Promise<LivePromoCode[]> {
  seedFromConfig(); // Ensure seeded on first call
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      resolve(codes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, 50); // Simulate network delay
  });
}

// Public API: Get a single live promo code by ID
export async function getLivePromoCode(id: string): Promise<LivePromoCode | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const code = codes.find((c) => c.id === id);
      resolve(code || null);
    }, 50);
  });
}

// Public API: Get a live promo code by code string (case-insensitive)
export async function getLivePromoByCode(code: string): Promise<LivePromoCode | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const promo = codes.find((c) => c.code.toLowerCase() === code.toLowerCase());
      resolve(promo || null);
    }, 50);
  });
}

// Public API: Create a new live promo code
export async function createLivePromoCode(
  input: CreateLivePromoInput
): Promise<{ success: boolean; data?: LivePromoCode; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      
      const validation = validatePromoInput(input, codes);
      if (!validation.valid) {
        resolve({ success: false, error: validation.error });
        return;
      }

      const now = new Date().toISOString();
      const newCode: LivePromoCode = {
        id: `promo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code: input.code.toUpperCase(),
        type: input.type,
        benefit: input.benefit,
        discountType: input.discountType,
        discountValue: input.discountValue,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        usageLimit: input.usageLimit,
        currentUsage: 0,
        isActive: input.isActive,
        createdAt: now,
        updatedAt: now,
      };

      codes.push(newCode);
      setStorageData(codes);
      resolve({ success: true, data: newCode });
    }, 100);
  });
}

// Public API: Update an existing live promo code
export async function updateLivePromoCode(
  input: UpdateLivePromoInput
): Promise<{ success: boolean; data?: LivePromoCode; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const index = codes.findIndex((c) => c.id === input.id);

      if (index === -1) {
        resolve({ success: false, error: "Promo code not found." });
        return;
      }

      const validation = validatePromoInput(input as CreateLivePromoInput, codes, input.id);
      if (!validation.valid) {
        resolve({ success: false, error: validation.error });
        return;
      }

      const updated: LivePromoCode = {
        ...codes[index],
        ...input,
        code: input.code?.toUpperCase() || codes[index].code,
        updatedAt: new Date().toISOString(),
      };

      codes[index] = updated;
      setStorageData(codes);
      resolve({ success: true, data: updated });
    }, 100);
  });
}

// Public API: Toggle active status
export async function toggleLivePromoCode(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; data?: LivePromoCode; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const index = codes.findIndex((c) => c.id === id);

      if (index === -1) {
        resolve({ success: false, error: "Promo code not found." });
        return;
      }

      codes[index].isActive = isActive;
      codes[index].updatedAt = new Date().toISOString();
      setStorageData(codes);
      resolve({ success: true, data: codes[index] });
    }, 100);
  });
}

// Public API: Delete a live promo code
export async function deleteLivePromoCode(id: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const filtered = codes.filter((c) => c.id !== id);

      if (codes.length === filtered.length) {
        resolve({ success: false, error: "Promo code not found." });
        return;
      }

      setStorageData(filtered);
      resolve({ success: true });
    }, 100);
  });
}

// Public API: Increment usage count (called when a code is successfully applied)
export async function incrementLivePromoUsage(id: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const codes = getStorageData();
      const index = codes.findIndex((c) => c.id === id);

      if (index === -1) {
        resolve({ success: false, error: "Promo code not found." });
        return;
      }

      codes[index].currentUsage += 1;
      codes[index].updatedAt = new Date().toISOString();
      setStorageData(codes);
      resolve({ success: true });
    }, 50);
  });
}

// Public API: Check if a live promo code is valid for use
export async function isLivePromoValid(
  code: string
): Promise<{ valid: boolean; promo?: LivePromoCode; reason?: string }> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const promo = await getLivePromoByCode(code);
      
      if (!promo) {
        resolve({ valid: false, reason: "Promo code not found." });
        return;
      }

      const status = computePromoStatus(promo);

      if (status === "disabled") {
        resolve({ valid: false, promo, reason: "This promo code has been disabled." });
        return;
      }

      if (status === "expired") {
        resolve({ valid: false, promo, reason: "This promo code has expired." });
        return;
      }

      if (status === "scheduled") {
        const startDate = new Date(promo.startDate).toLocaleDateString();
        resolve({ valid: false, promo, reason: `This promo code will be active starting ${startDate}.` });
        return;
      }

      if (promo.currentUsage >= promo.usageLimit) {
        resolve({ valid: false, promo, reason: "This promo code has reached its usage limit." });
        return;
      }

      resolve({ valid: true, promo });
    }, 50);
  });
}
