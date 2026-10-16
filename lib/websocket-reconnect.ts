const INITIAL_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const warnedChannels = new Set<string>();

/** Exponential reconnect backoff for persistent or transient WebSocket failures. */
export function getWebSocketReconnectDelay(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return Math.min(
    INITIAL_RECONNECT_DELAY_MS * 2 ** (safeAttempt - 1),
    MAX_RECONNECT_DELAY_MS,
  );
}

/** Avoid flooding the application console when a socket endpoint is unavailable. */
export function warnWebSocketUnavailableOnce(channel: string): void {
  if (warnedChannels.has(channel)) return;
  warnedChannels.add(channel);
  console.warn(`[Yummy realtime] ${channel} connection unavailable; retrying with backoff.`);
}
