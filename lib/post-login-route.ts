import { getHomeRouteForUser } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";

type AuthUser = Parameters<typeof getHomeRouteForUser>[0] & {
  restaurant_id?: number | null;
};

/**
 * After sign-in or session restore, pick the first stable route.
 * Users without a restaurant (except platform identities) go through onboarding/join.
 */
export function resolvePostLoginRoute(user: AuthUser): string {
  const { restaurant } = useRestaurant.getState();
  if (!user?.restaurant_id && !restaurant?.id) {
    return "/onboarding";
  }
  const home = getHomeRouteForUser(user);
  if (home !== "/dashboard") return home;

  if (restaurant?.hotel_enabled && !restaurant?.restaurant_enabled) return "/hotel";

  return home;
}
