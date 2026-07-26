export function optionalCustomerText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

export function customerPanValidationMessage(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  return /^\d{9}$/.test(normalized)
    ? null
    : "PAN number must contain exactly 9 digits.";
}
