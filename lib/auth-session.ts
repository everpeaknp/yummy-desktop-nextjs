import { useAuth } from '@/hooks/use-auth';

/** Shape returned by POST /auth/refresh */
export interface RefreshSessionData {
  access_token: string;
  refresh_token?: string;
  user_id: number;
  user_name?: string;
  email?: string;
  user_role?: string;
  user_roles?: string[];
  primary_role?: string | null;
  restaurant_id?: number | null;
  currency?: string;
  permissions?: string[];
}

export function syncAuthFromRefreshResponse(data: RefreshSessionData): void {
  const roles: string[] =
    data.user_roles || (data.user_role ? [data.user_role] : []);
  const currentUser = useAuth.getState().user;
  const permissions = Array.isArray(data.permissions)
    ? data.permissions
    : currentUser?.permissions || [];

  useAuth.getState().setAuth(
    {
      id: data.user_id,
      email: data.email || '',
      full_name: data.user_name || '',
      role: data.user_role || '',
      roles,
      primary_role: data.primary_role || data.user_role || null,
      restaurant_id: data.restaurant_id ?? null,
      currency: data.currency,
      permissions,
    },
    data.access_token,
    data.refresh_token ?? useAuth.getState().refreshToken
  );
}
