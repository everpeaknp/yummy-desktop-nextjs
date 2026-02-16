"use client";

import { useAuth } from "@/hooks/use-auth";
import { GlobalLoader } from "@/components/global-loader";
import { useEffect } from "react";

export function GlobalLoaderOverlay() {
  const isRedirecting = useAuth((state) => state.isRedirecting);
  const setRedirecting = useAuth((state) => state.setRedirecting);
  
  // If we mount and we are in "redirecting" state, it usually means 
  // we either arrived at the new page or are stuck.
  // We should clear it to ensure the UI is interactive.
  useEffect(() => {
    if (isRedirecting) {
      // Short delay to allow any server-side compilation to finish 
      // or to bridge the visual gap if it's a soft navigation.
      const timer = setTimeout(() => {
        setRedirecting(false);
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isRedirecting, setRedirecting]);

  if (!isRedirecting) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background animate-in fade-in duration-300">
      <GlobalLoader />
    </div>
  );
}
