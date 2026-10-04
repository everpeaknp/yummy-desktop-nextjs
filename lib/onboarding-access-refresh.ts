export const ONBOARDING_ACCESS_REFRESH_INTERVAL_MS = 10_000;

export function shouldRefreshOnboardingAccess(
  lastRefreshAt: number,
  now: number,
): boolean {
  return (
    lastRefreshAt <= 0 ||
    now - lastRefreshAt >= ONBOARDING_ACCESS_REFRESH_INTERVAL_MS
  );
}
