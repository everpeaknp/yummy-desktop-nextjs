"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSessionRestoreState,
  getSessionRestoreState,
  subscribeSessionRestore,
} from "@/lib/session-restore";

export function useSessionRestoreState() {
  return useSyncExternalStore(
    subscribeSessionRestore,
    getSessionRestoreState,
    getServerSessionRestoreState,
  );
}
