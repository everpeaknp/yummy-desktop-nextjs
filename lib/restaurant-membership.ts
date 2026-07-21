export const MEMBERSHIP_EVENT_NAME = "yummy:membership-event";

export type MembershipEventType =
  | "join_request.created"
  | "join_request.approved"
  | "join_request.cancelled"
  | "invitation.accepted"
  | "invitation.declined";

export type MembershipEventPayload = {
  request_id?: number;
  invitation_id?: number;
  restaurant_id?: number;
  user_id?: number;
  status?: string;
  selected_role?: string | null;
};

export type MembershipEventDetail = {
  event: MembershipEventType;
  payload: MembershipEventPayload;
};

export function isMembershipEvent(value: unknown): value is MembershipEventType {
  return value === "join_request.created"
    || value === "join_request.approved"
    || value === "join_request.cancelled"
    || value === "invitation.accepted"
    || value === "invitation.declined";
}

export function dispatchMembershipEvent(detail: MembershipEventDetail) {
  window.dispatchEvent(new CustomEvent<MembershipEventDetail>(MEMBERSHIP_EVENT_NAME, { detail }));
}

export function addMembershipEventListener(
  listener: (detail: MembershipEventDetail) => void,
) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<MembershipEventDetail>).detail);
  };
  window.addEventListener(MEMBERSHIP_EVENT_NAME, handler);
  return () => window.removeEventListener(MEMBERSHIP_EVENT_NAME, handler);
}
