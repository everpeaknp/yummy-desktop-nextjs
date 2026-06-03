/**
 * Per-action request locks and idempotency keys for payment / table / split flows.
 */

const activeLocks = new Set<string>();

export type ActionLockContext = {
  idempotencyKey: string;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function isActionLocked(actionKey: string): boolean {
  return activeLocks.has(actionKey);
}

/**
 * Runs fn once per actionKey. Concurrent calls return undefined without invoking fn.
 */
export async function runLockedAction<T>(
  actionKey: string,
  fn: (ctx: ActionLockContext) => Promise<T>
): Promise<T | undefined> {
  if (activeLocks.has(actionKey)) return undefined;
  activeLocks.add(actionKey);
  const idempotencyKey = newIdempotencyKey();
  try {
    return await fn({ idempotencyKey });
  } finally {
    activeLocks.delete(actionKey);
  }
}

/** Paths that should send X-Request-ID when idempotencyKey is set on the request config. */
export const IDEMPOTENT_API_PATH_PATTERNS: RegExp[] = [
  /\/orders\/\d+\/payments$/,
  /\/guest-bills\/transfer-table$/,
  /\/guest-bills\/merge$/,
  /\/guest-bills\/pay-all$/,
  /\/split-bill$/,
];

export function pathNeedsIdempotency(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0];
  return IDEMPOTENT_API_PATH_PATTERNS.some((re) => re.test(path));
}
