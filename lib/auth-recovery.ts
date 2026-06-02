/**
 * Guards against api-client clearing tokens while session restore is in flight
 * (common on cold start in Electron when access token is expired but refresh is valid).
 */
let recoveryDepth = 0;

export function beginAuthRecovery(): void {
  recoveryDepth += 1;
}

export function endAuthRecovery(): void {
  recoveryDepth = Math.max(0, recoveryDepth - 1);
}

export function isAuthRecoveryActive(): boolean {
  return recoveryDepth > 0;
}

export async function runAuthRecovery<T>(fn: () => Promise<T>): Promise<T> {
  beginAuthRecovery();
  try {
    return await fn();
  } finally {
    endAuthRecovery();
  }
}
