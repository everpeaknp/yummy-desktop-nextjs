import { getHomeRouteForUser } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";

type AuthUser = Parameters<typeof getHomeRouteForUser>[0] & {
  restaurant_id?: number | null;
};

/**
 * After sign-in or session restore, pick the first stable route (gateway when dual-module).
 * Users without a restaurant (except platform identities) go through onboarding/join.
 */
export function resolvePostLoginRoute(user: AuthUser): string {
  // If user has restaurant_id in their profile, they should NOT be on onboarding
  // even if the restaurant store hasn't loaded yet
  if (!user?.restaurant_id) {
    return "/onboarding";
  }

  const { restaurant, selectedModule } = useRestaurant.getState();
  const home = getHomeRouteForUser(user);
  if (home !== "/dashboard") return home;

  if (
    restaurant?.hotel_enabled &&
    restaurant?.restaurant_enabled &&
    !selectedModule
  ) {
    return "/gateway";
  }

  return home;
}
