/** A stable tour selector for a visible item in the mobile bottom navigation. */
export function mobileNavigationTourKey(href: string) {
  return `mobile-nav-${href
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/gi, "")}`;
}

export function mobileNavigationTourSelector(href: string) {
  return `[data-tour="${mobileNavigationTourKey(href)}"]`;
}
