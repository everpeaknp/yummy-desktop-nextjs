// Promo Code Configuration
// Add festival/offer codes here with their benefits

export interface OfferCode {
  code: string;
  benefit: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  description: string;
  expiryDate?: string; // Optional expiry date
  isActive: boolean;
}

export const OFFER_CODES: OfferCode[] = [
  {
    code: "DASHAIN20",
    benefit: "20% off",
    discountType: "percentage",
    discountValue: 20,
    description: "Dashain Festival Special - 20% discount on your subscription",
    expiryDate: "2027-10-31", // Optional: set expiry date
    isActive: true,
  },
  // Add more festival/offer codes here
  // Example:
  // {
  //   code: "NEWYEAR50",
  //   benefit: "Rs. 50 off",
  //   discountType: "fixed",
  //   discountValue: 50,
  //   description: "New Year Special - Rs. 50 discount",
  //   isActive: true,
  // },
];

export function getOfferCode(code: string): OfferCode | null {
  const offer = OFFER_CODES.find(
    (c) => c.code.toLowerCase() === code.toLowerCase() && c.isActive
  );
  return offer || null;
}

export function isOfferCodeExpired(offer: OfferCode): boolean {
  if (!offer.expiryDate) return false;
  return new Date(offer.expiryDate) < new Date();
}
