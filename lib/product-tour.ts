"use client";

/** Dispatched to start (or restart) the guided product tour from anywhere. */
export const START_PRODUCT_TOUR_EVENT = "yummy-start-product-tour";

export function requestProductTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_PRODUCT_TOUR_EVENT));
}
