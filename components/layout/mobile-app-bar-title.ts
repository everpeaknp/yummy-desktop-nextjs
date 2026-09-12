"use client";

import { useEffect } from "react";

export const MOBILE_APP_BAR_TITLE_EVENT = "yummy:mobile-app-bar-title";

export function useMobileAppBarTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title || typeof window === "undefined") return;

    document.documentElement.dataset.mobileAppBarTitle = title;
    window.dispatchEvent(
      new CustomEvent<string>(MOBILE_APP_BAR_TITLE_EVENT, { detail: title }),
    );

    return () => {
      if (document.documentElement.dataset.mobileAppBarTitle === title) {
        delete document.documentElement.dataset.mobileAppBarTitle;
      }
      window.dispatchEvent(
        new CustomEvent<string | null>(MOBILE_APP_BAR_TITLE_EVENT, { detail: null }),
      );
    };
  }, [title]);
}
