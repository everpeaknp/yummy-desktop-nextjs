export function resolveAuthorizedReceiptTerminalId(
  authorizationTerminalId: number | null | undefined,
  selectedTerminalId: number | null,
): number | null {
  return authorizationTerminalId ?? selectedTerminalId;
}
