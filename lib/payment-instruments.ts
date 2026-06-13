export type PaymentQrInstrument = {
  name: string;
  payload: string;
};

export type PaymentCardInstrument = {
  name: string;
  identifier?: string | null;
};

export type PaymentInstrumentPayload = {
  type: string;
  name: string;
  meta?: Record<string, unknown>;
};

export function extractPaymentInstruments(restaurant: unknown): {
  staticPaymentQrs: PaymentQrInstrument[];
  staticPaymentCards: PaymentCardInstrument[];
} {
  const source = restaurant as any;
  const staticPaymentQrs = Array.isArray(source?.payment_qrs)
    ? source.payment_qrs
        .filter((q: any) => q && typeof q.payload === "string" && q.payload.trim())
        .map((q: any) => ({
          name: String(q.name || "QR"),
          payload: String(q.payload),
        }))
    : [];
  const staticPaymentCards = Array.isArray(source?.payment_cards)
    ? source.payment_cards
        .filter((c: any) => c && typeof c.name === "string" && c.name.trim())
        .map((c: any) => ({
          name: String(c.name),
          identifier: c.identifier ? String(c.identifier) : null,
        }))
    : [];

  return { staticPaymentQrs, staticPaymentCards };
}

export function buildPaymentInstrument(
  method: string,
  staticPaymentQrs: PaymentQrInstrument[],
  staticPaymentCards: PaymentCardInstrument[],
  qrIndex: number,
  cardIndex: number,
): PaymentInstrumentPayload | null {
  if (method === "digital" || method === "fonepay") {
    const selected = staticPaymentQrs[qrIndex];
    if (!selected) return null;
    return {
      type: "static_qr",
      name: selected.name,
      meta: {
        payload: selected.payload,
        index: qrIndex,
      },
    };
  }

  if (method === "card") {
    const selected = staticPaymentCards[cardIndex];
    if (!selected) return null;
    return {
      type: "card",
      name: selected.name,
      meta: {
        identifier: selected.identifier || null,
        index: cardIndex,
      },
    };
  }

  return null;
}

export function paymentMethodNeedsInstrument(method: string): boolean {
  return method === "card" || method === "digital" || method === "fonepay";
}
