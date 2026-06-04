import { getHomeRouteForUser } from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";

type AuthUser = Parameters<typeof getHomeRouteForUser>[0];

/**
 * After sign-in or session restore, pick the first stable route (gateway when dual-module).
 */
export function resolvePostLoginRoute(user: AuthUser): string {
  const home = getHomeRouteForUser(user);
  if (home !== "/dashboard") return home;

  const { restaurant, selectedModule } = useRestaurant.getState();
  if (
    restaurant?.hotel_enabled &&
    restaurant?.restaurant_enabled &&
    !selectedModule
  ) {
    return "/gateway";
  }

  return home;
}
