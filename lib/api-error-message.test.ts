import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "./api-error-message";

describe("getApiErrorMessage", () => {
  it("formats channel-specific consent errors", () => {
    expect(
      getApiErrorMessage(
        {
          response: {
            data: {
              detail: {
                code: "CONSENT_CAPTURE_FAILED",
                errors: {
                  sms: "Phone marketing requires a valid customer phone number",
                  email: "Email marketing requires a customer email address",
                },
              },
            },
          },
        },
        "fallback",
      ),
    ).toBe(
      "SMS: Phone marketing requires a valid customer phone number; EMAIL: Email marketing requires a customer email address",
    );
  });

  it("includes drawer blockers returned during day-close confirmation", () => {
    expect(
      getApiErrorMessage(
        {
          response: {
            data: {
              detail: {
                message: "Day close is blocked by incomplete drawer controls.",
                blockers: ["General drawer must be recounted."],
              },
            },
          },
        },
        "Request failed",
      ),
    ).toBe("Day close is blocked by incomplete drawer controls.\n• General drawer must be recounted.");
  });
});
