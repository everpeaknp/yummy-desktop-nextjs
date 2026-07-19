"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductTour } from "@/components/onboarding/product-tour";
import { consumePendingTour } from "@/lib/onboarding";
import { requestProductTour, START_PRODUCT_TOUR_EVENT } from "@/lib/product-tour";

/**
 * Global host so Help → Product Tour works from any dashboard page,
 * not only when the dashboard route remounts with ?tour=1.
 */
export function ProductTourHost() {
  const [tourOpen, setTourOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";

  const openTour = useCallback(() => {
    // Force a close→open cycle so the tour can restart from step 1.
    setTourOpen(false);
    window.setTimeout(() => setTourOpen(true), 30);
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
  }, []);

  useEffect(() => {
    const onStart = () => openTour();
    window.addEventListener(START_PRODUCT_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_PRODUCT_TOUR_EVENT, onStart);
  }, [openTour]);

  // One-shot bootstrap from URL / post-onboarding flag
  useEffect(() => {
    const wantsTour = searchParams?.get("tour") === "1" || consumePendingTour();
    if (!wantsTour) return;

    const timer = window.setTimeout(() => requestProductTour(), 500);

    if (searchParams?.get("tour") === "1") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tour");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }

    return () => window.clearTimeout(timer);
    // Only react to tour query changes — avoid re-opening on every searchParams object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get("tour")]);

  return <ProductTour open={tourOpen} onClose={closeTour} />;
}
