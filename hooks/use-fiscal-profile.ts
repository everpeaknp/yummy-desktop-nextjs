"use client";

import { useCallback, useEffect, useState } from "react";
import { fiscalApi } from "@/lib/fiscal/api";
import {
  isActiveVatProfile,
  isActiveVatEbillingProfile,
  type FiscalProfile,
} from "@/lib/fiscal/types";

export function useFiscalProfile(enabled = true) {
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setProfile(await fiscalApi.getProfileOrLegacy());
    } catch (requestError) {
      console.warn("[fiscal] Failed to load fiscal profile", requestError);
      setProfile(null);
      setError("Fiscal compliance status is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    profile,
    loading,
    error,
    isActiveVat: isActiveVatProfile(profile),
    isActiveVatEbilling: isActiveVatEbillingProfile(profile),
    refresh,
  };
}
