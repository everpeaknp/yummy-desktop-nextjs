"use client";

import { useEffect } from "react";
import type { SyncDomain, SyncInvalidationDetail } from "@/lib/sync-invalidation";

function eventNameForDomain(domain: SyncDomain): string {
  return `yummy:invalidate:${domain}`;
}

type SyncInvalidationHandler = (detail: SyncInvalidationDetail) => void;

/**
 * Subscribe to invalidation events for one or more domains and refetch from backend.
 */
export function useSyncInvalidation(
  domains: SyncDomain[],
  onInvalidate: SyncInvalidationHandler,
  deps: unknown[] = []
): void {
  const domainKey = domains.join(",");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlers = domains.map((domain) => {
      const handler = (event: Event) => {
        const custom = event as CustomEvent<SyncInvalidationDetail>;
        onInvalidate(custom.detail ?? {});
      };
      const name = eventNameForDomain(domain);
      window.addEventListener(name, handler);
      return { name, handler };
    });

    return () => {
      for (const { name, handler } of handlers) {
        window.removeEventListener(name, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies refetch deps
  }, [domainKey, onInvalidate, ...deps]);
}
