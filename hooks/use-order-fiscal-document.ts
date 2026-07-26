"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { fiscalApi } from "@/lib/fiscal/api";
import type {
  FiscalDocument,
  IssueFiscalDocumentInput,
} from "@/lib/fiscal/types";

const inFlightDocuments = new Map<number, Promise<FiscalDocument>>();

async function loadOrIssueFiscalDocument(
  orderId: number,
  input: IssueFiscalDocumentInput,
): Promise<FiscalDocument> {
  const existingRequest = inFlightDocuments.get(orderId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const existing = await fiscalApi.getOrderDocument(orderId);
    return existing ?? fiscalApi.issueOrderDocument(orderId, input);
  })();
  inFlightDocuments.set(orderId, request);
  try {
    return await request;
  } finally {
    inFlightDocuments.delete(orderId);
  }
}

export function useOrderFiscalDocument({
  orderId,
  enabled,
  buyerName,
  buyerAddress,
  buyerPan,
}: {
  orderId: number;
  enabled: boolean;
  buyerName?: string | null;
  buyerAddress?: string | null;
  buyerPan?: string | null;
}) {
  const [document, setDocument] = useState<FiscalDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !orderId) {
      setDocument(null);
      setLoading(false);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const nextDocument = await loadOrIssueFiscalDocument(orderId, {
        buyer_name: buyerName?.trim() || null,
        buyer_address: buyerAddress?.trim() || null,
        buyer_pan: buyerPan?.trim() || null,
      });
      setDocument(nextDocument);
      return nextDocument;
    } catch (requestError) {
      const message = getApiErrorMessage(
        requestError,
        "The immutable fiscal document could not be loaded or issued.",
      );
      setDocument(null);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [buyerAddress, buyerName, buyerPan, enabled, orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { document, loading, error, refresh };
}
