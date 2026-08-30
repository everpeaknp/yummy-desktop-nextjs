/**
 * Finance section navigation now lives exclusively in the main sidebar.
 *
 * Keeping this no-op component temporarily avoids a broad, risky edit across
 * older finance report screens while removing the duplicated navigation from
 * every rendered page. Call sites can be deleted gradually as those screens
 * are touched.
 */
export function FinanceSectionTabs() {
  return null;
}
