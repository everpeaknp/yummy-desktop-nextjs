export function resolveAuthorizedReceiptTerminalId(
  authorizationTerminalId: number | null | undefined,
  selectedTerminalId: number | null,
  soleAssignedTerminalId: number | null = null,
): number | null {
  return authorizationTerminalId ?? selectedTerminalId ?? soleAssignedTerminalId;
}
