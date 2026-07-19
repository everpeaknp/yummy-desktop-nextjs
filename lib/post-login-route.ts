import { getHomeRouteForUser } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";

type AuthUser = {
  role?: string | null;
  roles?: string[] | null;
  primary_role?: string | null;
  permissions?: string[];
  restaurant_id?: number | null;
} | null;

function isAdminLike(user: NonNullable<AuthUser>) {
  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role,
    user.primary_role,
  ]
    .filter(Boolean)
    .map((r) => String(r).toLowerCase());
  return roles.some((r) => r === "admin" || r === "owner" || r === "manager");
}

/**
 * After sign-in or session restore, pick the first stable route (gateway when dual-module).
 * First-time admins without a restaurant go through onboarding.
 */
export function resolvePostLoginRoute(user: AuthUser): string {
  const { restaurant } = useRestaurant.getState();
  const hasRestaurant = Boolean(restaurant?.id || user?.restaurant_id);

  if (user && !hasRestaurant && isAdminLike(user)) {
    return "/onboarding";
  }

  const home = getHomeRouteForUser(user);
  if (home !== "/dashboard") return home;

  const { selectedModule } = useRestaurant.getState();
  if (
    restaurant?.hotel_enabled &&
    restaurant?.restaurant_enabled &&
    !selectedModule
  ) {
    return "/gateway";
  }

  return home;
}
