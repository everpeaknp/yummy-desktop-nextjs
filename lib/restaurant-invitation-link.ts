export const PENDING_INVITATION_TOKEN_KEY =
  "yummy:pending-invitation-token";

const invitationTokenPattern = /^[A-Za-z0-9_-]{8,64}$/;

export function normalizeInvitationToken(value: string | null | undefined) {
  const token = value?.trim() || "";
  return invitationTokenPattern.test(token) ? token : "";
}

export function invitationTokenFromPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.pathname.replace(/\/$/, "") !== "/invite") return "";
    return normalizeInvitationToken(url.searchParams.get("token"));
  } catch {
    return normalizeInvitationToken(trimmed);
  }
}

export function invitationTokenFromSearch(search: string) {
  return normalizeInvitationToken(
    new URLSearchParams(search).get("token"),
  );
}
