/** Canonical keys for client-side auth persistence (Electron + browser). */
export const AUTH_ACCESS_TOKEN_KEY = 'accessToken';
export const AUTH_REFRESH_TOKEN_KEY = 'refreshToken';
export const AUTH_ZUSTAND_STORAGE_KEY = 'auth-storage';

export function readStoredTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }
  return {
    accessToken: localStorage.getItem(AUTH_ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(AUTH_REFRESH_TOKEN_KEY),
  };
}

export function writeStoredTokens(
  accessToken: string | null,
  refreshToken: string | null
): void {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  }
  if (refreshToken) {
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  }
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  const { accessToken, refreshToken } = readStoredTokens();
  return Boolean(accessToken || refreshToken);
}
