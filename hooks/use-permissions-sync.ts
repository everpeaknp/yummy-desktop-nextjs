"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

const MIN_SYNC_INTERVAL_MS = 30_000;

/**
 * Keeps Zustand user.permissions in sync when an admin changes roles/permissions
 * in another tab or for this user on the server.
 */
export function usePermissionsSync() {
  const syncUserProfile = useAuth((s) => s.syncUserProfile);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    const maybeSync = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (now - lastSyncAt.current < MIN_SYNC_INTERVAL_MS) return;
      lastSyncAt.current = now;
      void syncUserProfile();
    };

    window.addEventListener("focus", maybeSync);
    document.addEventListener("visibilitychange", maybeSync);
    return () => {
      window.removeEventListener("focus", maybeSync);
      document.removeEventListener("visibilitychange", maybeSync);
    };
  }, [syncUserProfile]);
}
