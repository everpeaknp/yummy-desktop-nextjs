"use client";

import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";

interface ReceiptDetailSheetProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Compatibility entry point for receipt lists and order history. A receipt is
 * one part of the completed sale, so every entry point now opens the canonical
 * sale detail instead of a second receipt-only drawer.
 */
export function ReceiptDetailSheet({
  orderId,
  open,
  onOpenChange,
}: ReceiptDetailSheetProps) {
  return (
    <SalesDocumentDetailSheet
      orderId={orderId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
