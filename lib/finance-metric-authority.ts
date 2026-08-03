export function shouldUseFinanceMetrics(
  ledgerComplete: boolean | null | undefined,
  metricValues: readonly unknown[] | null | undefined,
): boolean {
  if (!metricValues) return false;
  if (ledgerComplete === true) return true;
  return metricValues.some(
    (value) => Math.abs(Number(value) || 0) > 0.0001,
  );
}
