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
  const { restaurant, selectedModule } = useRestaurant.getState();
  const identityRoles = [user?.role, user?.primary_role, ...(user?.roles || [])]
    .map((role) => String(role || "").trim().toLowerCase());
  const isPlatformIdentity = identityRoles.some((role) =>
    ["superadmin", "super_admin", "platform_staff"].includes(role),
  );
  if (!user?.restaurant_id && !restaurant?.id && !isPlatformIdentity) {
    return "/onboarding";
  }
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
