export function attendanceLocationState(
  latitude: number | null,
  longitude: number | null,
) {
  return latitude == null || longitude == null ? "missing" : "configured";
}

export function attendanceRadiusLabel(radiusMeters: number) {
  if (radiusMeters <= 75) return "Small venue";
  if (radiusMeters <= 250) return "Typical restaurant";
  if (radiusMeters <= 600) return "Large property";
  return "Extended site";
}
