import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "./api-error-message";

describe("getApiErrorMessage", () => {
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
