// Live Promo Code Types
// These codes are for subscription-level promotions and offers

export interface LivePromoCode {
  id: string;
  code: string;
  type: "referral" | "offer";
  benefit: string; // Display text like "20% OFF" or "1 MONTH FREE"
  discountType: "percentage" | "fixed";
  discountValue: number;
  description: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  usageLimit: number;
  currentUsage: number;
  isActive: boolean; // User toggle for enable/disable
  createdAt: string;
  updatedAt: string;
}

export type LivePromoStatus = "active" | "scheduled" | "expired" | "disabled";

export interface LivePromoFilters {
  status: "all" | LivePromoStatus;
  searchQuery: string;
}

export interface CreateLivePromoInput {
  code: string;
  type: "referral" | "offer";
  benefit: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  description: string;
  startDate: string;
  endDate: string;
  usageLimit: number;
  isActive: boolean;
}

export interface UpdateLivePromoInput extends Partial<CreateLivePromoInput> {
  id: string;
}
