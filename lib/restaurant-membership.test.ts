import { describe, expect, it, vi } from "vitest";
import {
  addMembershipEventListener,
  dispatchMembershipEvent,
  isMembershipEvent,
} from "@/lib/restaurant-membership";

describe("restaurant membership event bridge", () => {
  it("accepts only supported realtime membership events", () => {
    expect(isMembershipEvent("join_request.created")).toBe(true);
    expect(isMembershipEvent("join_request.approved")).toBe(true);
    expect(isMembershipEvent("join_request.cancelled")).toBe(true);
    expect(isMembershipEvent("invitation.accepted")).toBe(true);
    expect(isMembershipEvent("invitation.declined")).toBe(true);
    expect(isMembershipEvent("notifications_unread")).toBe(false);
  });

  it("delivers typed payloads and unsubscribes cleanly", () => {
    const listener = vi.fn();
    const remove = addMembershipEventListener(listener);

    dispatchMembershipEvent({
      event: "join_request.approved",
      payload: { request_id: 12, user_id: 8, restaurant_id: 3 },
    });
    expect(listener).toHaveBeenCalledWith({
      event: "join_request.approved",
      payload: { request_id: 12, user_id: 8, restaurant_id: 3 },
    });

    remove();
    dispatchMembershipEvent({ event: "invitation.accepted", payload: {} });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
