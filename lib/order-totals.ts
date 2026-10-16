/**
 * Order prices are tax-inclusive in the backend: `subtotal` already contains
 * VAT and `tax_total` is the VAT component of that subtotal. A discount must
 * therefore come from the persisted discount fields, never from
 * `subtotal + tax_total - grand_total` (that formula mislabels VAT as a
 * discount when no discount was applied).
 */
export function getRecordedOrderDiscount(order: {
  discount_total?: number | null;
  manual_discount_amount?: number | null;
}): number {
  const configuredDiscount = Number(order.discount_total ?? 0);
  const manualDiscount = Number(order.manual_discount_amount ?? 0);
  const discount = Math.max(
    Number.isFinite(configuredDiscount) ? configuredDiscount : 0,
    Number.isFinite(manualDiscount) ? manualDiscount : 0,
    0,
  );

  return Number(discount.toFixed(2));
}

export function getOrderDiscountLabel(order: {
  growth_offer_id?: number | null;
  growth_campaign_id?: number | null;
  growth_offer_name?: string | null;
  manual_discount_amount?: number | null;
}): string {
  const offerName = order.growth_offer_name?.trim();
  if (offerName) return `Grow offer: ${offerName}`;
  if (order.growth_offer_id || order.growth_campaign_id) return "Grow offer";
  if (Number(order.manual_discount_amount || 0) > 0) return "Manual discount";
  return "Discount";
}
