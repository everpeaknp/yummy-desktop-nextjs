import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

export function kitchenStationOptions(user: Parameters<typeof hasPermission>[0], custom: string[] = []): string[] {
  const fixed = (["Kitchen", "Bar", "Cafe"] as const).filter((name) =>
    hasPermission(user, `station.${name.toLowerCase()}.view` as PermissionKey),
  );
  const extra = hasPermission(user, "inventory.stations.manage")
    ? custom.filter((name) => !["all", "kitchen", "bar", "cafe"].includes(name.toLowerCase()))
    : [];
  const stations = [...fixed, ...Array.from(new Set(extra))];
  return stations.length > 1 ? ["All", ...stations] : stations;
}
