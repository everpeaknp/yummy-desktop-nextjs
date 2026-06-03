"use client";

import { useCallback, useState } from "react";
import {
  isActionLocked,
  runLockedAction,
  type ActionLockContext,
} from "@/lib/request-lock";

/**
 * Component-level action lock with loading flag for submit buttons.
 */
export function useActionLock(actionKey: string) {
  const [locking, setLocking] = useState(false);

  const run = useCallback(
    async <T,>(fn: (ctx: ActionLockContext) => Promise<T>): Promise<T | undefined> => {
      if (isActionLocked(actionKey)) return undefined;
      setLocking(true);
      try {
        return await runLockedAction(actionKey, fn);
      } finally {
        setLocking(false);
      }
    },
    [actionKey]
  );

  return {
    locking,
    isLocked: locking || isActionLocked(actionKey),
    run,
  };
}
