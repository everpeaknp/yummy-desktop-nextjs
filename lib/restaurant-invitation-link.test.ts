import { describe, expect, it } from "vitest";
import {
  invitationTokenFromPayload,
  invitationTokenFromSearch,
  normalizeInvitationToken,
} from "@/lib/restaurant-invitation-link";

describe("private restaurant invitation links", () => {
  it("extracts tokens from the dedicated invite route", () => {
    expect(
      invitationTokenFromPayload(
        "https://app.yummyever.com/invite?token=private-token",
      ),
    ).toBe("private-token");
    expect(invitationTokenFromSearch("?token=private-token")).toBe(
      "private-token",
    );
  });

  it("does not treat public join links as private invitations", () => {
    expect(
      invitationTokenFromPayload(
        "https://app.yummyever.com/join?code=ABCD1234",
      ),
    ).toBe("");
  });

  it("rejects malformed or oversized tokens", () => {
    expect(normalizeInvitationToken("short")).toBe("");
    expect(normalizeInvitationToken("contains spaces")).toBe("");
    expect(normalizeInvitationToken("a".repeat(65))).toBe("");
  });
});
